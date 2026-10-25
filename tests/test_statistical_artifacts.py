import json
import joblib
import numpy as np
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import create_app
from app.predictor import load_valuation_metrics, empirical_interval
from app.recommender import RecommendationEngine, DATA, ARTIFACT


def test_actual_response_uses_cv_quantiles():
    with TestClient(create_app()) as client:
        response = client.post('/predict-price', json=client.app.state.bundle.metadata['example_payload'])
        assert response.status_code == 200
        result = response.json()
        metrics = client.app.state.valuation_metrics
        assert result['predicted_price'] == result['predicted_price_inr']
        bounds = result['valuation_range']
        assert bounds['lower_bound'] == round(max(0, np.expm1(result['log_prediction'] + metrics['q10_residual']) * 1e7), 2)
        assert bounds['upper_bound'] == round(np.expm1(result['log_prediction'] + metrics['q90_residual']) * 1e7, 2)
        assert bounds['mae_pct'] == metrics['mae_percentage']
        assert bounds['q90_residual'] == metrics['q90_residual']
        assert bounds['confidence_level'] == '80% Empirical Prediction Interval'


def test_statistics_reject_nonfinite_and_mismatched_models(tmp_path):
    import shutil
    directory = ARTIFACT.parent
    for name in ['xgboost_model.json', 'preprocessor.pkl']:
        shutil.copyfile(directory / name, tmp_path / name)
    metrics = json.loads((directory / 'valuation_metrics.json').read_text())
    for patch in [{'q10_residual': float('nan')}, {'q10_residual': 1, 'q90_residual': -1}, {'model_sha256': 'wrong'}]:
        (tmp_path / 'valuation_metrics.json').write_text(json.dumps({**metrics, **patch}))
        with pytest.raises(ValueError):
            load_valuation_metrics(tmp_path)
    assert empirical_interval(0, {'q10_residual': -1, 'q90_residual': 1, 'mae_percentage': 20})['lower_bound'] == 0


def test_recommender_requires_valid_learned_weights(tmp_path):
    artifact = joblib.load(ARTIFACT)
    artifact['feature_importances'] = np.zeros(141)
    path = tmp_path / 'pipeline.pkl'
    joblib.dump(artifact, path)
    import shutil
    shutil.copyfile(ARTIFACT.with_name('property_embeddings.pkl'), tmp_path / 'property_embeddings.pkl')
    with pytest.raises(ValueError, match='importances'):
        RecommendationEngine(DATA, path)
    engine = RecommendationEngine()
    assert not np.allclose(engine.feature_scale, engine.feature_scale[0])
    assert engine.weighted_matrix.shape == (3554, 141)
