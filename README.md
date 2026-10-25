# PropVision AI — Real Estate Valuation & Recommender Platform

## Executive Overview

PropVision AI is a Gurgaon real estate intelligence suite combining property valuation, geographic analytics, sector narratives and content-based recommendations. The React dashboard turns a processed property snapshot into interpretable estimates and comparisons, with Express coordinating requests to a Python ML service.

Analytics describe a historical listing dataset rather than live inventory or transaction prices. Estimates and similarity scores support exploration; they are not guarantees of sale value or investment returns.

## Architecture

```text
FastAPI ML Service       ↔       Express Orchestrator       ↔       React/Vite Dashboard
Python / app/                   Node.js / server/                   client/
XGBoost + fitted transforms     Validation and API error mapping    Valuation and recommendations
Residual-based intervals       ML proxy and metadata cache         Leaflet maps and sector insights
Cosine recommendations         MongoDB connection/model            Responsive light/dark UI
          ↕
artifacts/tuned_v1/ + data/processed/ + data/reference/
```

The browser sends raw property features to Express. FastAPI owns preprocessing, inference and artifact validation. Model outputs in `log1p(crores)` are converted to INR once in Python. MongoDB is required by the Express startup path; ML inference and snapshot analytics read local files.

## Key Modules

1. **Price Predictor:** tuned XGBoost valuation from 12 raw features, with an **80% Empirical Prediction Interval** using $Q_{10}/Q_{90}$ of five-fold cross-validation log residuals. Bounds are asymmetric after conversion to INR. Coverage is nominal rather than independently validated: hyperparameters were previously tuned on this dataset.
2. **GeoMap Analytics:** Leaflet maps across **115 Gurgaon sector/locality labels**, with sector statistics and feature comparisons. Coordinates include normalized references and disclosed fallback positions; the ambiguous `new` label uses a city-level fallback.
3. **Market Insights Sector Narrative Engine:** deterministic, evidence-based summaries, sector tiers, asking-price distribution alerts and layout comparisons. Narratives use snapshot aggregates rather than an external language model.
4. **Content-Based Recommender Engine:** cosine vector similarity over saved structured property embeddings, weighted by learned price relevance. Similar-property ranking blends 75% weighted cosine and 25% price proximity; contextual search applies sector/budget constraints and includes price proximity when a target price is supplied. Vector similarity and blended match scores have separate meanings.

## Quickstart

Use Python 3.13 and Node.js 22.15+ with the checked-in dependency files. Run each service in a separate terminal. Preserve existing environment files and the complete `artifacts/tuned_v1/` bundle.

### 1. ML Microservice

This checkout implements FastAPI in `app/`, with Python requirements at the repository root. Run from the root:

```sh
python -m venv .venv
# Activate .venv: Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

If `.venv` exists, reuse it. The alternate-layout command `cd ml_service && pip install -r requirements.txt && uvicorn main:app --port 8000` does **not** apply to this checkout: there is no `ml_service/` directory. Health and OpenAPI are available at http://127.0.0.1:8000/health and http://127.0.0.1:8000/docs.

The serving model is `artifacts/tuned_v1/xgboost_model.json`, accompanied by `preprocessor.pkl` and metadata. Recommendations require `recommender_pipeline.pkl` and `property_embeddings.pkl`; interval statistics live in `valuation_metrics.json`. Keep these matched artifacts together. Only deserialize trusted local model bundles.

### 2. Express Backend

Create `server/.env` from `server/.env.example` on first setup, without overwriting an existing file. Set `MONGO_URI` for an available MongoDB instance and `FASTAPI_URL=http://127.0.0.1:8000`. Then run:

```sh
cd server && npm install && npm run dev
```

Express defaults to http://127.0.0.1:5000 and starts after MongoDB connects. Check `/api/health`. Core routes include `/api/predict`, `/api/schema-options`, `/api/analytics/*`, `/api/insights/*` and `/api/recommend/*`.

### 3. React Frontend

```sh
cd client && npm install && npm run dev
```

Open Vite's printed URL, normally http://127.0.0.1:5173. The default API base is `http://localhost:5000`; use `client/.env.local` based on `.env.example` to change `VITE_API_URL`. All `VITE_*` configuration is public in the built browser application. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. For reproducible lockfile installs, `npm ci` can replace `npm install`.

## Testing

Start Vite, then open the end-to-end runner in a separate terminal:

```sh
cd client && npm run test:e2e
```

For headless execution, use `npm run test:e2e:headless` from `client/`. The Cypress suite uses deterministic API fixtures and intercepted map tiles; it does not require Express, FastAPI or MongoDB. See [the Cypress guide](client/cypress/README.md) for local cache and base URL settings.

Additional checks from the repository root:

```sh
pip install -r requirements-dev.txt
python -m pytest tests -q
npm --prefix server test
npm --prefix client test
npm --prefix client run build
```

## Project Reference

- [FastAPI endpoints and statistical artifacts](app/README.md)
- [Analytics and map sources](docs/ANALYTICS_MODULE.md)
- [Market Insights scoring and limitations](docs/MARKET_INSIGHTS.md)
- [Model contract and units](docs/PRODUCTION_TECHNICAL_SPEC.md)

Numbered notebooks and processed dataset stages preserve the research lineage. Export future model versions into a new artifact directory rather than replacing `tuned_v1`. Local credentials, dependencies, generated caches and confidential documentation are excluded through the root `.gitignore`.
