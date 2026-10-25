import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.recommender import RecommendationEngine
from sklearn.metrics.pairwise import cosine_similarity


@pytest.fixture(scope='module')
def engine():
    return RecommendationEngine()


def test_score_and_identity(engine):
    cards = engine.get_similar_properties(0)
    assert cards == engine.get_similar_properties(engine.properties.iloc[0].property_id)
    assert len(cards) == 6
    assert all(c['row_id'] != 0 for c in cards)
    for card in cards:
        i = card['row_id']
        target = engine.properties.iloc[0].price
        penalty = abs(card['price'] - target) / max(card['price'], target)
        sim = cosine_similarity(engine.weighted_matrix[0:1], engine.weighted_matrix[i:i+1])[0, 0]
        assert card['vector_match_percentage'] == round(float(sim) * 100, 1)
        assert penalty <= .35
        assert card['match_percentage'] == round((.75 * sim + .25 * (1 - penalty)) * 100, 1)
        assert card['price_inr'] == card['price_crore'] * 1e7


def test_context_filters(engine):
    cards = engine.get_recommendations_by_search_context(
        {'sector': ' Sector 104 ', 'bedRoom': 3, 'budget': 15000000, 'min_price': 10000000})
    assert cards
    assert all(c['sector'] == 'sector 104' and 1e7 <= c['price'] <= 1.5e7 for c in cards)
    assert engine.get_recommendations_by_search_context({'sector': 'nonexistent'}) == []
    assert engine.get_recommendations_by_search_context({'max_price': 1}) == []


def test_nonfinite_fallback(engine, monkeypatch):
    import app.recommender as module
    monkeypatch.setattr(module, 'cosine_similarity', lambda *args: np.full((1, len(engine.frame)), np.nan))
    assert all(np.isfinite(c['match_percentage']) for c in engine.get_similar_properties(0))
    monkeypatch.setattr(module, 'cosine_similarity', lambda *args: np.full((1, len(engine.frame)), np.inf))
    assert all(np.isfinite(c['match_percentage']) for c in engine.get_recommendations_by_search_context({}))


def test_endpoints(engine):
    application = create_app()
    application.state.recommender = engine
    with TestClient(application) as client:
        response = client.post('/api/v1/recommend/similar', json={'property_id': 0, 'top_n': 3})
        assert response.status_code == 200
        assert len(response.json()) == 3
        assert client.post('/api/v1/recommend/similar', json={'property_id': 99999}).status_code == 404
        assert client.post('/api/v1/recommend/similar', json={'property_id': 0, 'top_n': 0}).status_code == 422
        assert client.post('/api/v1/recommend/contextual', json={'sector': 'sector 104', 'price': 12000000, 'bedRoom': 3, 'built_up_area': 1600, 'luxury_category': 'Luxury'}).status_code == 200
        assert client.post('/api/v1/recommend/contextual', json={'min_price': 20, 'max_price': 10}).status_code == 422
        assert client.post('/api/v1/recommend/contextual', content='{"price":NaN}', headers={'Content-Type':'application/json'}).status_code == 422

def test_inspector_metadata_matches_dataset(engine):
    card = engine.get_similar_properties(0, 1)[0]
    row = engine.properties.iloc[card['row_id']]
    sector = engine.properties.loc[engine.properties.sector.eq(row.sector)]
    assert card['sector_median_price_per_sqft'] == float((sector.price / sector.built_up_area).median())
    assert card['agePossession'] == row.agePossession
    assert card['amenities']['Servant room'] == bool(row['servant room'])
    assert card['amenities']['Store room'] == bool(row['store room'])
    assert card['luxury_score'] is None
