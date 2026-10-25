import json
from pathlib import Path
import shutil

from fastapi.testclient import TestClient
import numpy as np
import pandas as pd
import pytest

from app.main import create_app, format_inr

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / 'artifacts/tuned_v1'


@pytest.fixture(scope='module')
def client():
    with TestClient(create_app(BUNDLE)) as test_client:
        yield test_client


def example(client):
    return client.app.state.bundle.metadata['example_payload'].copy()


def test_health_and_actual_schema(client):
    response = client.get('/health')
    assert response.status_code == 200
    metadata = response.json()['metadata']
    assert metadata['schema_version'] == 'propvision-tuned-v1'
    assert metadata['resolved_model_parameters']['missing'] is None
    inventory = json.loads((ROOT / 'docs/dataset_schema_inventory.json').read_text())
    source = next(v for k, v in inventory.items() if k.endswith('post_feature_selection_v2.csv'))
    assert metadata['feature_columns'] == [c['name'] for c in source['columns'] if c['name'] != 'price']


def test_prediction_matches_artifact_and_inverse_units(client):
    payload = example(client)
    # JSON key order cannot affect preprocessing.
    response = client.post('/predict-price', json=dict(reversed(list(payload.items()))))
    assert response.status_code == 200, response.text
    bundle = client.app.state.bundle
    frame = pd.DataFrame([payload], columns=bundle.columns)
    expected_log = float(bundle.model.predict(bundle.preprocessor.transform(frame))[0])
    result = response.json()
    assert result['log_prediction'] == expected_log
    assert result['predicted_price_inr'] == round(float(np.expm1(expected_log) * 1e7), 2)
    assert result['formatted_price'].startswith('₹')


@pytest.mark.parametrize('field,value', [
    ('sector', 'unknown sector'), ('property_type', 'office'), ('bedRoom', 0),
    ('bedRoom', True), ('bedRoom', 2.5), ('built_up_area', -1),
    ('built_up_area', 'NaN'), ('balcony', 1), ('servant room', 2),
    ('bathroom', None), ('floor_category', ''), ('total_sqft', 1500),
])
def test_prediction_validation(client, field, value):
    payload = example(client)
    payload[field] = value
    assert client.post('/predict-price', json=payload).status_code == 422


def test_missing_prediction_field(client):
    payload = example(client)
    del payload['store room']
    assert client.post('/predict-price', json=payload).status_code == 422


@pytest.mark.parametrize('value', [float('nan'), float('inf'), float('-inf')])
def test_nonfinite_json_rejected_cleanly(client, value):
    payload = example(client)
    payload['built_up_area'] = value
    response = client.post('/predict-price', content=json.dumps(payload),
                           headers={'Content-Type': 'application/json'})
    assert response.status_code == 422
    assert response.json()['detail']


def test_cors(client):
    response = client.options('/predict-price', headers={
        'Origin': 'https://example.com', 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'})
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == '*'


def test_price_labels():
    assert format_inr(14_200_000) == '₹1.42 Cr'
    assert format_inr(8_500_000) == '₹85 Lakhs'


def test_unready_and_shutdown():
    application = create_app(BUNDLE)
    with TestClient(application) as running:
        assert running.get('/health').status_code == 200
    assert application.state.bundle is None
    with TestClient(create_app(BUNDLE)) as running:
        running.app.state.bundle = None
        assert running.get('/health').status_code == 503


def test_startup_missing_and_corrupt_bundle(tmp_path):
    with pytest.raises(RuntimeError, match='Missing artifacts'):
        with TestClient(create_app(tmp_path)):
            pass

    for name in ['model_metadata.json', 'preprocessor.pkl', 'xgboost_model.json']:
        shutil.copyfile(BUNDLE / name, tmp_path / name)
    with (tmp_path / 'xgboost_model.json').open('ab') as handle:
        handle.write(b'corrupt')
    with pytest.raises(ValueError, match='checksum mismatch'):
        with TestClient(create_app(tmp_path)):
            pass


def test_prediction_only_bundle_and_removed_routes(tmp_path):
    for name in ['model_metadata.json', 'preprocessor.pkl', 'xgboost_model.json']:
        shutil.copyfile(BUNDLE / name, tmp_path / name)
    with TestClient(create_app(tmp_path)) as client:
        payload = client.app.state.bundle.metadata['example_payload']
        assert client.post('/predict-price', json=payload).status_code == 200
        assert client.post('/recommend-properties', json={}).status_code == 404
        assert '/recommend-properties' not in client.get('/openapi.json').json()['paths']


def test_export_prediction_bundle_roundtrip(tmp_path):
    from scripts.export_artifacts import export

    destination = tmp_path / 'predictor'
    export(ROOT / 'data/processed/gurgaon_properties_post_feature_selection_v2.csv', destination)
    assert {p.name for p in destination.iterdir()} == {
        'preprocessor.pkl', 'xgboost_model.json', 'model_metadata.json', 'requirements-lock.txt'}
    with TestClient(create_app(destination)) as exported:
        payload = exported.app.state.bundle.metadata['example_payload']
        response = exported.post('/predict-price', json=payload)
        assert response.status_code == 200
        assert response.json()['predicted_price_inr'] > 0
    with pytest.raises(FileExistsError):
        export(ROOT / 'data/processed/gurgaon_properties_post_feature_selection_v2.csv', destination)


def test_inference_error_is_sanitized(client, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError('private internal failure')
    monkeypatch.setattr(client.app.state.bundle.model, 'predict', broken)
    response = client.post('/predict-price', json=example(client))
    assert response.status_code == 500
    assert response.json() == {'detail': 'Price inference failed'}
