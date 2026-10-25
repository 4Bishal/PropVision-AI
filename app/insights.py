"""Explainable listing-snapshot insights. No model fitting or return forecasts."""
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Request

from .analytics import PropertyType, AnalyticsEngine

router = APIRouter(prefix='/insights', tags=['Market insights'])
MIN_LISTINGS = 5
AGE_ORDER = ['New Property', 'Relatively New', 'Moderately Old', 'Old Property', 'Under Construction']
TIERS = {'premium': 'Premium Luxury', 'value': 'Growth Corridor', 'affordable': 'Affordable Entry'}


class InsightsEngine:
    def __init__(self, analytics: AnalyticsEngine):
        self.analytics = analytics

    def selection(self, property_type=None, sector=None):
        return self.analytics.select(property_type=property_type, sector=sector)

    def meta(self, frame, property_type=None, sector=None):
        return {**self.analytics.meta(frame, (property_type, None, sector)),
                'method_version': 'insights-v1', 'minimum_group_size': MIN_LISTINGS,
                'interpretation': 'Historical asking-price associations; not transaction values or investment returns.'}

    @lru_cache(maxsize=8)
    def rankings(self, property_type=None):
        frame = self.selection(property_type)
        rows = []
        for name, group in frame.groupby('sector', sort=True):
            possession = [{'stage': stage, 'listing_count': int(group.agePossession.eq(stage).sum()),
                           'share_percent': round(float(group.agePossession.eq(stage).mean() * 100), 2)} for stage in AGE_ORDER]
            rows.append({'sector': name, **self.analytics.price_summary(group),
                         'entry_price_cr': round(float(group.price.quantile(.25)), 4),
                         'luxury_share_percent': round(float(group.luxury_category.eq('Luxury').mean() * 100), 2),
                         'avg_price_per_sqft_inr': round(float(group.price_per_sqft_inr.mean()), 2),
                         'dominant_property_type': str(group.property_type.mode().iloc[0]),
                         'possession_distribution': possession})
        # Peer percentiles keep every score reproducible and scale-independent.
        import pandas as pd
        eligible = pd.DataFrame([r for r in rows if r['listing_count'] >= MIN_LISTINGS])
        ranked = []
        if not eligible.empty:
            price = eligible.median_price_cr.rank(pct=True)
            luxury = eligible.luxury_share_percent.rank(pct=True)
            density_value = eligible.median_price_per_sqft_inr.rank(pct=True, ascending=False)
            volume = eligible.listing_count.rank(pct=True)
            entry = eligible.entry_price_cr.rank(pct=True, ascending=False)
            for index, row in eligible.iterrows():
                scores = {'premium': float(.6 * price[index] + .4 * luxury[index]),
                          'value': float(.5 * density_value[index] + .5 * volume[index]),
                          'affordable': float(entry[index])}
                tier = max(scores, key=scores.get)
                ranked.append({**row.to_dict(), 'tier': tier, 'tier_label': TIERS[tier],
                               'scores': {key: round(value * 100, 2) for key, value in scores.items()},
                               'score': round(scores[tier] * 100, 2)})
        ranked.sort(key=lambda r: (-r['score'], -r['listing_count'], r['sector']))
        return {'meta': self.meta(frame, property_type), 'sectors': ranked,
                'limited_sample_sectors': [r for r in rows if r['listing_count'] < MIN_LISTINGS],
                'methodology': {
                    'premium': '60% median-price percentile + 40% Luxury-share percentile.',
                    'value': '50% inverse median price/sqft percentile + 50% listing-count percentile.',
                    'affordable': 'Inverse 25th-percentile asking-price percentile (entry-price proxy).',
                    'assignment': 'Highest score assigns one tier per sector; ties prefer premium, then value. Scores are relative to the selected property-type peers.',
                    'limitations': 'Growth Corridor is a value/volume screen, not verified geography or a growth forecast. Listing counts are snapshot observations, not live availability. Five listings is a display safeguard, not statistical significance.'}}

    @staticmethod
    def comparison(without, with_feature):
        counts = (len(without), len(with_feature))
        base = float(without.price.median()) if counts[0] else None
        value = float(with_feature.price.median()) if counts[1] else None
        status = 'unavailable' if not all(counts) else 'limited' if min(counts) < MIN_LISTINGS else 'descriptive'
        return {'baseline_count': counts[0], 'comparison_count': counts[1],
                'baseline_median_cr': base, 'comparison_median_cr': value,
                'difference_cr': round(value - base, 4) if all(counts) else None,
                'difference_percent': round((value / base - 1) * 100, 2) if all(counts) else None,
                'status': status}

    @lru_cache(maxsize=64)
    def alerts(self, property_type=None, sector=None):
        frame = self.selection(property_type, sector)
        sectors, layouts, bedrooms = [], [], []
        for name, group in frame.groupby('sector', sort=True):
            q1, q3 = float(group.price.quantile(.25)), float(group.price.quantile(.75))
            uc = int(group.agePossession.eq('Under Construction').sum())
            # Non-UC ages are a possession-age proxy, not verified readiness/title.
            sectors.append({'sector': name, **self.analytics.price_summary(group),
                            'q1_price_cr': round(q1, 4), 'q3_price_cr': round(q3, 4),
                            'iqr_price_cr': round(q3 - q1, 4),
                            'relative_iqr': round((q3 - q1) / float(group.price.median()), 4),
                            'under_construction_count': uc, 'non_under_construction_count': len(group) - uc,
                            'under_construction_share_percent': round(uc / len(group) * 100, 2),
                            'limited_sample': len(group) < MIN_LISTINGS})
        for (name, kind), group in frame.groupby(['sector', 'property_type'], sort=True):
            for bhk in sorted(group.bedRoom.unique()):
                if bhk + 1 in set(group.bedRoom):
                    bedrooms.append({'sector': name, 'property_type': kind, 'from_bhk': int(bhk), 'to_bhk': int(bhk + 1),
                                     **self.comparison(group.loc[group.bedRoom.eq(bhk)], group.loc[group.bedRoom.eq(bhk + 1)])})
            for bhk, cohort in group.groupby('bedRoom', sort=True):
                for feature, baseline, options in [
                    ('furnishing_type', 'unfurnished', ['semifurnished', 'furnished']),
                    ('servant room', 0, [1]), ('floor_category', 'Low-Rise', ['Mid-Rise', 'High-Rise'])]:
                    for option in options:
                        if not cohort[feature].eq(option).any():
                            continue
                        layouts.append({'sector': name, 'property_type': kind, 'bhk': int(bhk),
                                        'feature': feature, 'baseline': baseline, 'comparison': option,
                                        **self.comparison(cohort.loc[cohort[feature].eq(baseline)], cohort.loc[cohort[feature].eq(option)])})
        checklist = [
            'Compare similar homes in the same micro-location by built-up area, condition, floor and parking.',
            'Verify the recorded built-up area, bedroom count and asking price against the original listing.',
            'Check title, approvals, possession documentation, dues and total acquisition costs with qualified local professionals.',
            'Visit the property and verify access, maintenance, utility-room usability and actual possession status.']
        if any(r['under_construction_count'] for r in sectors):
            checklist.append('For under-construction options, verify project registration, approvals, delivery commitments and payment milestones.')
        if any(r['relative_iqr'] >= .75 for r in sectors):
            checklist.append('Asking prices vary widely here; compare property type, plot/area and luxury mix before treating a low price as a bargain.')
        if len(frame) < MIN_LISTINGS:
            checklist.append('This selection has fewer than five listings; obtain more comparable properties before drawing pricing conclusions.')
        return {'meta': self.meta(frame, property_type, sector), 'sectors': sectors,
                'layout_comparisons': layouts, 'bedroom_comparisons': bedrooms, 'buyer_checklist': checklist,
                'methodology': 'Layout groups match sector, property type and BHK. Bedroom comparisons match sector and property type only. Area, condition, age and luxury are uncontrolled. Negative differences are retained; fewer than five per group is limited evidence. Non-under-construction is not verified ready-to-move.'}

    @lru_cache(maxsize=8)
    def narratives(self, property_type=None):
        rankings = self.rankings(property_type)
        rows = rankings['sectors']
        bullets = []
        if rows:
            expensive = max(rows, key=lambda r: (r['median_price_per_sqft_inr'], r['sector']))
            entry = min(rows, key=lambda r: (r['entry_price_cr'], r['sector']))
            value = max(rows, key=lambda r: (r['scores']['value'], r['listing_count'], r['sector']))
            bullets = [
                {'id': 'density', 'badge': 'Premium benchmark', 'sector': expensive['sector'],
                 'text': f"{expensive['sector']} has the highest median asking price per sq ft among eligible sectors: INR {expensive['median_price_per_sqft_inr']:,.0f}, across {expensive['listing_count']} listings.",
                 'evidence': {'metric': 'median_price_per_sqft_inr', 'value': expensive['median_price_per_sqft_inr'], 'listing_count': expensive['listing_count']}},
                {'id': 'entry', 'badge': 'Entry-price screen', 'sector': entry['sector'],
                 'text': f"{entry['sector']} has the lowest lower-quartile asking price among eligible sectors: INR {entry['entry_price_cr']:.2f} Cr. Confirm area and property mix before shortlisting.",
                 'evidence': {'metric': 'entry_price_cr', 'value': entry['entry_price_cr'], 'listing_count': entry['listing_count']}},
                {'id': 'value', 'badge': 'Value / volume screen', 'sector': value['sector'],
                 'text': f"{value['sector']} leads the relative value/volume screen, with median INR {value['median_price_per_sqft_inr']:,.0f}/sq ft and {value['listing_count']} snapshot listings. This does not establish future growth.",
                 'evidence': {'metric': 'value_score', 'value': value['scores']['value'], 'listing_count': value['listing_count']}}]
        return {'meta': rankings['meta'], 'generation': 'Deterministic data-grounded templates; no external AI model is called.',
                'title': 'Your executive market brief', 'bullets': bullets,
                'takeaways': ['Asking prices are not completed transaction prices.',
                              'No dated observations are available: growth, yield and future returns cannot be inferred.',
                              'Compare local properties with similar area, condition and specifications before making an offer.']}


def selection(request: Request, property_type: PropertyType | None = None):
    engine = getattr(request.app.state, 'insights', None)
    if engine is None:
        raise HTTPException(503, 'Insights dataset is not ready')
    return engine, property_type


@router.get('/sector-rankings')
def sector_rankings(selected=Depends(selection)):
    engine, kind = selected
    return engine.rankings(kind)


@router.get('/summary-narratives')
def summary_narratives(selected=Depends(selection)):
    engine, kind = selected
    return engine.narratives(kind)


@router.get('/valuation-alerts')
def valuation_alerts(request: Request, selected=Depends(selection), sector: str | None = None):
    engine, kind = selected
    if sector is not None and (len(sector) > 200 or sector not in set(request.app.state.analytics.frame.sector)):
        raise HTTPException(422, 'Unsupported sector')
    return engine.alerts(kind, sector)
