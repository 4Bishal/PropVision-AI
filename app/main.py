"""Run from project root: uvicorn app.main:app --host 0.0.0.0 --port 8000."""
from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
import pandas as pd

from .artifacts import Bundle, load_bundle
from .schemas import PredictionInput, PredictionOutput, SimilarInput, ContextualInput
from .recommender import get_engine
from .predictor import load_valuation_metrics, empirical_interval
from .analytics import AnalyticsEngine, router as analytics_router
from .insights import InsightsEngine, router as insights_router

logger = logging.getLogger(__name__)
DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[1] / 'artifacts' / 'tuned_v1'


def format_inr(price: float) -> str:
    if price >= 10_000_000:
        value, label = price / 10_000_000, 'Cr'
    elif price >= 100_000:
        value, label = price / 100_000, 'Lakhs'
    else:
        return f'₹{price:,.2f}'
    return f'₹{value:.2f}'.rstrip('0').rstrip('.') + f' {label}'


def get_bundle(request: Request) -> Bundle:
    bundle = getattr(request.app.state, 'bundle', None)
    if bundle is None:
        raise HTTPException(503, 'Model bundle is not ready')
    return bundle


def check_categories(values: dict, bundle: Bundle) -> None:
    errors = [dict(loc=['body', c], msg=f'Unsupported value: {values[c]}',
                   type='unknown_category', allowed=sorted(allowed))
              for c, allowed in bundle.categories.items()
              if c in values and values[c] not in allowed]
    if errors:
        raise HTTPException(422, detail=errors)


def create_app(artifact_dir: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        directory = Path(artifact_dir or os.getenv('ARTIFACT_DIR', DEFAULT_ARTIFACT_DIR))
        threads = int(os.getenv('MODEL_THREADS', '1'))
        if threads < 1:
            raise ValueError('MODEL_THREADS must be positive')
        application.state.bundle = load_bundle(directory, threads)
        application.state.valuation_metrics = load_valuation_metrics(directory)
        application.state.artifact_dir = directory
        application.state.analytics = AnalyticsEngine()
        application.state.insights = InsightsEngine(application.state.analytics)
        try:
            yield
        finally:
            application.state.bundle = None
            application.state.analytics = None
            application.state.insights = None

    application = FastAPI(title='PropVision AI ML Service', version='1.0.0', lifespan=lifespan)
    application.add_middleware(CORSMiddleware, allow_origins=['*'],
                               allow_credentials=False, allow_methods=['GET', 'POST'],
                               allow_headers=['*'])
    application.include_router(analytics_router)
    application.include_router(insights_router)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        # Do not echo NaN/Infinity or exception objects into a JSON error body.
        return JSONResponse(status_code=422, content={'detail': [
            {k: error[k] for k in ('loc', 'msg', 'type')} for error in exc.errors()]})

    def recommendations(request: Request):
        engine = getattr(request.app.state, 'recommender', None)
        if engine is None:
            try:
                engine = get_engine(request.app.state.artifact_dir)
                engine.sector_tiers = {row['sector']: row['tier_label'] for row in request.app.state.insights.rankings()['sectors']}
                request.app.state.recommender = engine
            except Exception as exc:
                logger.exception('Recommendation artifacts failed to load')
                raise HTTPException(503, 'Recommendation engine is not ready') from exc
        return engine

    @application.post('/api/v1/recommend/similar')
    def recommend_similar(payload: SimilarInput, request: Request):
        try:
            return recommendations(request).get_similar_properties(
                payload.property_id, payload.top_n, payload.max_price_diff_pct)
        except KeyError as exc:
            raise HTTPException(404, 'Property not found') from exc

    @application.post('/api/v1/recommend/contextual')
    def recommend_contextual(payload: ContextualInput, request: Request):
        try:
            return recommendations(request).get_recommendations_by_search_context(
                payload.model_dump(exclude={'top_n'}, exclude_none=True), payload.top_n)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

    @application.get('/health')
    def health(request: Request):
        bundle = get_bundle(request)
        return {'status': 'healthy', 'metadata': bundle.metadata}

    @application.post('/predict-price', response_model=PredictionOutput)
    def predict_price(payload: PredictionInput, request: Request):
        bundle = get_bundle(request)
        values = payload.model_dump(by_alias=True)
        check_categories(values, bundle)
        try:
            raw = pd.DataFrame([values], columns=bundle.columns)
            transformed = bundle.preprocessor.transform(raw)
            if transformed.shape[1] != bundle.model.n_features_in_:
                raise ValueError('Inference feature width mismatch')
            predictions = np.asarray(bundle.model.predict(transformed)).reshape(-1)
            if predictions.size != 1:
                raise ValueError('Expected one model prediction')
            log_prediction = float(predictions[0])
            # JSON stores the inner regressor: invert log1p(crores), then convert to INR.
            with np.errstate(over='ignore', invalid='ignore'):
                price = float(np.expm1(log_prediction) * 10_000_000)
            if not np.isfinite(price) or price < 0:
                raise ValueError('Invalid price returned by model')
            return PredictionOutput(predicted_price=round(price, 2),
                                    valuation_range=empirical_interval(log_prediction, request.app.state.valuation_metrics),
                                    predicted_price_inr=round(price, 2),
                                    formatted_price=format_inr(price), log_prediction=log_prediction)
        except Exception as exc:
            logger.exception('Price inference failed')
            raise HTTPException(500, 'Price inference failed') from exc

    return application


app = create_app()
