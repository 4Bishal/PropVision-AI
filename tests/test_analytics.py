import json
from pathlib import Path

from fastapi.testclient import TestClient
import pandas as pd
import pytest

from app.analytics import AnalyticsEngine, DATASET
from app.main import create_app


@pytest.fixture(scope='module')
def client():
    with TestClient(create_app()) as client:
        yield client


def test_kpis_match_source_and_units(client):
    frame = pd.read_csv(DATASET)
    response = client.get('/analytics/kpis')
    assert response.status_code == 200
    data = response.json()
    assert data['total_listings'] == len(frame) == 3554
    assert data['avg_price_cr'] == round(frame.price.mean(), 4)
    assert data['median_price_per_sqft_inr'] == round((frame.price * 1e7 / frame.built_up_area).median(), 4)
    assert sum(r['listing_count'] for r in data['avg_price_by_property_type']) == len(frame)
    counts = frame.loc[frame.luxury_category.eq('Luxury')].groupby('sector').size()
    assert data['top_luxury_sector']['listing_count'] == counts.max()
    assert data['meta']['time_series_available'] is False


@pytest.mark.parametrize('property_type', ['flat', 'house'])
@pytest.mark.parametrize('luxury', ['Standard', 'Premium', 'Luxury'])
def test_all_panels_share_filter_scope(client, property_type, luxury):
    frame = pd.read_csv(DATASET)
    expected = frame.loc[frame.property_type.eq(property_type) & frame.luxury_category.eq(luxury)]
    params = {'property_type': property_type, 'luxury_category': luxury}
    for endpoint in ['kpis', 'geospatial', 'sector-breakdown', 'feature-correlations']:
        data = client.get(f'/analytics/{endpoint}', params=params).json()
        assert data['meta']['filtered_rows'] == len(expected)
        assert data['meta']['filters']['property_type'] == property_type
        assert data['meta']['filters']['luxury_category'] == luxury


def test_sector_sorting_and_population_variance(client):
    data = client.get('/analytics/sector-breakdown', params={'sort_by': 'median_price', 'limit': 15}).json()
    assert len(data['sectors']) == 15
    prices = [r['median_price_cr'] for r in data['sectors']]
    assert prices == sorted(prices, reverse=True)
    frame = pd.read_csv(DATASET)
    row = data['sectors'][0]
    group = frame.loc[frame.sector.eq(row['sector'])]
    assert row['price_variance_cr2'] == round(group.price.var(ddof=0), 6)
    volume = client.get('/analytics/sector-breakdown').json()['sectors']
    assert len(volume) == 20
    assert [r['listing_count'] for r in volume] == sorted([r['listing_count'] for r in volume], reverse=True)


def test_coordinates_provenance_and_coverage(client):
    data = client.get('/analytics/geospatial').json()
    assert len(data['sectors']) + len(data['unmapped_sectors']) == 115
    assert len(data['sectors']) == 114
    assert data['unmapped_sectors'] == ['new']
    assert data['unresolved_location_labels'] == []
    assert data['display_coverage_percent'] == round(114 / 115 * 100, 2)
    assert 'source_sha256' in data['coordinate_source']
    for row in data['sectors']:
        assert 28 < row['latitude'] < 29 and 76 < row['longitude'] < 78
        assert row['source_url'].startswith('https://')
        assert row['resolution'] in ['sector_polygon', 'normalized_sector', 'parent_sector', 'locality_reference', 'normalized_locality', 'city_fallback']
    assert data['mapped_listings'] == sum(r['listing_count'] for r in data['sectors'])


def test_feature_distributions_and_scatter_match_rows(client):
    data = client.get('/analytics/feature-correlations', params={'property_type': 'house'}).json()
    assert len(data['price_vs_area']) == 750
    assert all(p['property_type'] == 'house' for p in data['price_vs_area'])
    assert set(data['furnishing_types']) == {'furnished', 'semifurnished', 'unfurnished'}
    for field in ['luxury_distribution', 'age_distribution', 'floor_distribution']:
        assert sum(r['listing_count'] for r in data[field]) == 750
        for row in data[field]:
            assert row['min_price_cr'] <= row['q1_price_cr'] <= row['median_price_cr'] <= row['q3_price_cr'] <= row['max_price_cr']


def test_empty_combination_returns_null_not_nan(tmp_path):
    frame = pd.read_csv(DATASET).iloc[:1]
    source = tmp_path / 'one.csv'
    frame.to_csv(source, index=False)
    engine = AnalyticsEngine(source, tmp_path / 'missing-coordinates.json')
    missing_type = 'flat' if frame.iloc[0].property_type == 'house' else 'house'
    for kind in ['kpis', 'correlations', 'sectors', 'geospatial']:
        result = engine.aggregate(kind, property_type=missing_type)
        json.dumps(result, allow_nan=False)
        assert result['meta']['filtered_rows'] == 0
    assert engine.aggregate('kpis', property_type=missing_type)['avg_price_cr'] is None
    assert engine.aggregate('geospatial')['sectors'] == []
    assert engine.aggregate('sectors')['sectors'][0]['price_variance_cr2'] == 0


@pytest.mark.parametrize('params', [{'property_type': 'office'}, {'luxury_category': 'Fake'},
    {'limit': 0}, {'limit': 116}, {'sort_by': 'profit'}, {'sector': 'unseen sector'}])
def test_invalid_filters(client, params):
    assert client.get('/analytics/sector-breakdown', params=params).status_code == 422


def test_selected_sector_scopes_every_panel(client):
    for endpoint in ['kpis', 'geospatial', 'sector-breakdown', 'feature-correlations']:
        result = client.get(f'/analytics/{endpoint}', params={'sector': 'sector 56'}).json()
        assert result['meta']['filters']['sector'] == 'sector 56'
        assert result['meta']['filtered_rows'] > 0


def test_coordinate_centroid_algorithm():
    from scripts.refresh_sector_coordinates import geometry_centroid
    latitude, longitude = geometry_centroid({'type': 'Polygon',
        'coordinates': [[[0, 0], [4, 0], [4, 2], [0, 2], [0, 0]]]})
    assert latitude == pytest.approx(1)
    assert longitude == pytest.approx(2)


@pytest.mark.parametrize('name,normalized', [('New Sector 2', 'sector 2'),
    ('sector 3 phase 2', 'sector 3'), ('sector 3 phase 3 extension', 'sector 3'),
    ('sohna road road', 'sohna road'), (' sector 56 ', 'sector 56')])
def test_sector_normalization(name, normalized):
    assert AnalyticsEngine.normalize_sector(name) == normalized


def test_geocoder_false_matches_are_rejected(client):
    rows = {r['sector']: r for r in client.get('/analytics/geospatial').json()['sectors']}
    assert rows['sector 17a']['resolved_label'] == 'sector 17'
    assert rows['sector 17b']['resolution'] == 'parent_sector'
    assert rows['sector 9']['source_url'].endswith('/node/2733423637')
    assert rows['sector 9']['latitude'] > 28.45
    assert 'new' not in rows
    assert 'new' in client.get('/analytics/geospatial').json()['unmapped_sectors']
    assert rows['new sector 2']['latitude'] == rows['sector 2']['latitude']
    assert rows['sohna road road']['longitude'] == rows['sohna road']['longitude']


@pytest.mark.parametrize('endpoint', ['floor-price-density', 'utility-room-premium',
                                     'balcony-distribution', 'luxury-vs-possession'])
def test_intelligence_endpoints_filter_and_serialize(client, endpoint):
    frame = pd.read_csv(DATASET)
    expected = frame.loc[frame.property_type.eq('flat') & frame.luxury_category.eq('Luxury')]
    response = client.get('/analytics/' + endpoint, params={'property_type': 'flat', 'luxury_category': 'Luxury'})
    assert response.status_code == 200
    data = response.json()
    assert data['meta']['filtered_rows'] == len(expected)
    json.dumps(data, allow_nan=False)
    if endpoint != 'utility-room-premium':
        assert sum(r['listing_count'] for r in data.get('groups', data.get('cells', []))) == len(expected)


def test_floor_price_density_exact_medians(client):
    data = client.get('/analytics/floor-price-density').json()
    frame = pd.read_csv(DATASET)
    assert len(data['groups']) == 6
    for row in data['groups']:
        cohort = frame.loc[frame.floor_category.eq(row['floor_category']) & frame.property_type.eq(row['property_type'])]
        assert row['listing_count'] == len(cohort)
        if len(cohort):
            assert row['median_price_cr'] == round(cohort.price.median(), 4)
            assert row['median_price_per_sqft_inr'] == round((cohort.price * 1e7 / cohort.built_up_area).median(), 2)


def test_utility_differences_match_type_and_bhk_medians(client):
    data = client.get('/analytics/utility-room-premium').json()
    frame = pd.read_csv(DATASET)
    for row in data['groups']:
        cohort = frame.loc[frame.property_type.eq(row['property_type']) & frame.bedRoom.eq(row['bhk'])]
        without = cohort.loc[cohort[row['room']].eq(0)]
        with_room = cohort.loc[cohort[row['room']].eq(1)]
        assert row['with_room']['listing_count'] == len(with_room)
        assert row['without_room']['listing_count'] == len(without)
        if len(without) and len(with_room):
            difference = with_room.price.median() - without.price.median()
            assert row['observed_price_difference_cr'] == round(difference, 4)
            assert row['observed_difference_percent'] == round(difference / without.price.median() * 100, 2)
        else:
            assert row['observed_price_difference_cr'] is None
            assert row['comparison_available'] is False
    assert any(r['observed_price_difference_cr'] is not None and r['observed_price_difference_cr'] < 0 for r in data['groups'])
    assert 'not causal' in data['interpretation']


def test_balcony_variance_and_matrix_counts(client):
    data = client.get('/analytics/balcony-distribution').json()
    frame = pd.read_csv(DATASET)
    assert {r['balcony'] for r in data['groups']} == {'0', '1', '2', '3', '3+'}
    assert sum(r['listing_count'] for r in data['groups']) == len(frame)
    for row in data['groups']:
        group = frame.loc[frame.balcony.astype(str).eq(row['balcony']) & frame.property_type.eq(row['property_type'])]
        if len(group):
            assert row['price_variance_cr2'] == round(group.price.var(ddof=0), 6)
    matrix = client.get('/analytics/luxury-vs-possession').json()
    assert len(matrix['cells']) == 15
    assert sum(r['listing_count'] for r in matrix['cells']) == len(frame)


def test_missing_comparison_cohort_and_empty_matrix(tmp_path):
    source = tmp_path / 'single.csv'
    frame = pd.read_csv(DATASET).iloc[:1]
    frame.to_csv(source, index=False)
    engine = AnalyticsEngine(source, tmp_path / 'absent.json')
    for row in engine.aggregate('utility-room-premium')['groups']:
        assert row['observed_price_difference_cr'] is None
        assert row['small_sample'] is True
    missing = 'flat' if frame.iloc[0].property_type == 'house' else 'house'
    for kind in ['floor-price-density', 'utility-room-premium', 'balcony-distribution', 'luxury-vs-possession']:
        data = engine.aggregate(kind, property_type=missing)
        json.dumps(data, allow_nan=False)
        assert data['meta']['filtered_rows'] == 0
