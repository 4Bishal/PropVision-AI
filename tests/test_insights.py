import pytest
import pandas as pd
from fastapi.testclient import TestClient

from app.analytics import AnalyticsEngine, DATASET
from app.insights import InsightsEngine
from app.main import create_app


@pytest.fixture(scope='module')
def engine():
    return InsightsEngine(AnalyticsEngine())


@pytest.mark.parametrize('kind', [None, 'flat', 'house'])
def test_sector_partition_scores_and_units(engine, kind):
    result = engine.rankings(kind)
    frame = engine.selection(kind)
    assert len(result['sectors']) + len(result['limited_sample_sectors']) == frame.sector.nunique()
    assert sum(r['listing_count'] for r in result['sectors'] + result['limited_sample_sectors']) == len(frame)
    assert len({r['sector'] for r in result['sectors']}) == len(result['sectors'])
    for row in result['sectors']:
        source = frame.loc[frame.sector.eq(row['sector'])]
        assert row['listing_count'] >= 5
        assert row['median_price_cr'] == round(source.price.median(), 4)
        assert row['avg_price_per_sqft_inr'] == round(source.price_per_sqft_inr.mean(), 2)
        assert row['entry_price_cr'] == round(source.price.quantile(.25), 4)
        assert row['score'] == max(row['scores'].values())
        assert 0 <= row['score'] <= 100
        assert sum(p['listing_count'] for p in row['possession_distribution']) == len(source)
    assert result['meta']['time_series_available'] is False


def test_scores_follow_documented_peer_percentiles(engine):
    rows = pd.DataFrame(engine.rankings()['sectors']).set_index('sector')
    expected = .5 * rows.median_price_per_sqft_inr.rank(pct=True, ascending=False) + .5 * rows.listing_count.rank(pct=True)
    for name, score in expected.items():
        assert rows.loc[name, 'scores']['value'] == round(score * 100, 2)


def test_layout_differences_match_source_and_do_not_invent_premiums(engine):
    result = engine.alerts(sector='sector 56')
    frame = engine.selection(sector='sector 56')
    for row in result['layout_comparisons']:
        cohort = frame.loc[frame.property_type.eq(row['property_type']) & frame.bedRoom.eq(row['bhk'])]
        baseline = cohort.loc[cohort[row['feature']].eq(row['baseline'])]
        comparison = cohort.loc[cohort[row['feature']].eq(row['comparison'])]
        assert row['baseline_count'] == len(baseline)
        assert row['comparison_count'] == len(comparison)
        if len(baseline) and len(comparison):
            assert row['difference_cr'] == round(comparison.price.median() - baseline.price.median(), 4)
            assert row['status'] == ('limited' if min(len(baseline), len(comparison)) < 5 else 'descriptive')
        else:
            assert row['difference_cr'] is None
            assert row['status'] == 'unavailable'
    assert any(r['difference_cr'] is not None and r['difference_cr'] < 0 for r in engine.alerts()['layout_comparisons'])


def test_alerts_dispersion_and_possession_totals(engine):
    for row in engine.alerts()['sectors']:
        source = engine.selection(sector=row['sector'])
        assert row['price_variance_cr2'] == round(source.price.var(ddof=0), 6)
        assert row['under_construction_count'] + row['non_under_construction_count'] == len(source)
        assert row['under_construction_count'] == source.agePossession.eq('Under Construction').sum()


def test_narratives_ground_every_claim_in_eligible_sector(engine):
    ranks = {r['sector']: r for r in engine.rankings()['sectors']}
    result = engine.narratives()
    assert len(result['bullets']) == 3
    for bullet in result['bullets']:
        row = ranks[bullet['sector']]
        evidence = bullet['evidence']
        assert evidence['listing_count'] == row['listing_count']
        assert evidence['value'] == (row['scores']['value'] if evidence['metric'] == 'value_score' else row[evidence['metric']])
    assert 'no external AI' in result['generation']
    assert any('growth' in text for text in result['takeaways'])


def test_empty_and_tiny_selections_do_not_produce_ratings():
    analytics = AnalyticsEngine()
    analytics.frame = analytics.frame.head(1)
    engine = InsightsEngine(analytics)
    assert engine.rankings()['sectors'] == []
    assert engine.narratives()['bullets'] == []
    assert engine.alerts(property_type='flat')['meta']['filtered_rows'] == 0
    assert engine.alerts(property_type='flat')['sectors'] == []


def test_http_registration_validation_and_json_serialization():
    with TestClient(create_app()) as client:
        for endpoint in ['sector-rankings', 'summary-narratives', 'valuation-alerts']:
            result = client.get(f'/insights/{endpoint}', params={'property_type': 'flat'})
            assert result.status_code == 200
            assert result.json()['meta']['filters']['property_type'] == 'flat'
            assert client.get(f'/insights/{endpoint}?property_type=invalid').status_code == 422
        assert client.get('/insights/valuation-alerts?sector=unknown').status_code == 422
        selected = client.get('/insights/valuation-alerts?sector=sector+56').json()
        assert selected['meta']['filters']['sector'] == 'sector 56'
        assert [r['sector'] for r in selected['sectors']] == ['sector 56']
