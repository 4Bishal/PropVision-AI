"""Deterministic snapshot analytics; no model fitting or online geocoding."""
from functools import lru_cache
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / 'data/processed/gurgaon_properties_post_feature_selection_v2.csv'
COORDINATES = ROOT / 'data/reference/sector_coordinates.json'
FALLBACK_COORDINATES = ROOT / 'data/reference/sector_fallback_geocodes.json'
PropertyType = Literal['flat', 'house']
LuxuryTier = Literal['Standard', 'Premium', 'Luxury']
router = APIRouter(prefix='/analytics', tags=['Market analytics'])


class AnalyticsEngine:
    def __init__(self, source=DATASET, coordinates=COORDINATES):
        self.frame = pd.read_csv(source)
        numeric = self.frame[['price', 'built_up_area']].to_numpy(dtype=float)
        if self.frame.empty or not np.isfinite(numeric).all() or (numeric <= 0).any():
            raise ValueError('Analytics dataset must have finite positive prices and areas')
        for column in ['sector', 'property_type', 'luxury_category', 'agePossession',
                       'floor_category', 'furnishing_type']:
            if self.frame[column].isna().any():
                raise ValueError(f'Missing analytics values: {column}')
        self.frame['price_per_sqft_inr'] = self.frame.price * 10_000_000 / self.frame.built_up_area
        self.source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        self.source_name = source.name
        self.geo = json.loads(coordinates.read_text(encoding='utf-8')) if coordinates.is_file() else {
            'source': 'No coordinate reference installed', 'coordinates': {}}
        self.fallback_geo = json.loads(FALLBACK_COORDINATES.read_text(encoding='utf-8')) if FALLBACK_COORDINATES.is_file() else {'coordinates': {}}
        for location in [*self.geo['coordinates'].values(), *self.fallback_geo['coordinates'].values()]:
            if not (28 <= location['latitude'] <= 29 and 76 <= location['longitude'] <= 78):
                raise ValueError('Invalid Gurgaon reference coordinate')

    @staticmethod
    def normalize_sector(value):
        name = re.sub(r'\s+', ' ', value.casefold().strip())
        name = re.sub(r'^new\s+(?=sector\s+\d)', '', name)
        name = re.sub(r'\s+phase\s+\d+(?:\s+extension)?$', '', name)
        name = re.sub(r'\broad(?:\s+road)+\b', 'road', name)
        return name

    def resolve_sector(self, sector):
        """Retain labels; disclose aliases and unresolved city-level anchors."""
        normalized = self.normalize_sector(sector)
        if sector in self.geo['coordinates']:
            return {**self.geo['coordinates'][sector], 'resolution': 'sector_polygon', 'resolved_label': sector}
        if normalized in ['sector 17a', 'sector 17b'] and 'sector 17' in self.geo['coordinates']:
            return {**self.geo['coordinates']['sector 17'], 'resolution': 'parent_sector',
                    'resolved_label': 'sector 17', 'location_note': 'Parent Sector 17 reference; sub-sector boundaries are not resolved.'}
        if normalized in self.geo['coordinates']:
            return {**self.geo['coordinates'][normalized], 'resolution': 'normalized_sector',
                    'resolved_label': normalized, 'location_note': f'Alias of {normalized}; phase-level precision is unavailable.'}
        if normalized in self.fallback_geo['coordinates']:
            return {**self.fallback_geo['coordinates'][normalized], 'resolution': 'normalized_locality' if normalized != sector else 'locality_reference',
                    'resolved_label': normalized, 'location_note': 'Approximate named-locality or road reference, not a listing coordinate.'}
        # "new" is an ambiguous dataset label, not a uniquely geocodable place.
        # Display it at the documented city center, with no claim of precision.
        return {'latitude': 28.4595, 'longitude': 77.0266, 'resolution': 'city_fallback',
                'resolved_label': 'Gurgaon city reference', 'method': 'unresolved label shown at city reference',
                'source_url': 'https://www.openstreetmap.org/#map=12/28.4595/77.0266',
                'location_note': f'Location "{sector}" is unresolved. This city-level marker is not its actual location.'}

    @staticmethod
    def price_summary(group):
        if group.empty:
            return {'listing_count': 0, 'median_price_cr': None, 'median_price_per_sqft_inr': None,
                    'mean_price_cr': None, 'price_variance_cr2': None}
        return {'listing_count': len(group), 'median_price_cr': round(float(group.price.median()), 4),
                'median_price_per_sqft_inr': round(float(group.price_per_sqft_inr.median()), 2),
                'mean_price_cr': round(float(group.price.mean()), 4),
                'price_variance_cr2': round(float(group.price.var(ddof=0)), 6)}

    def select(self, property_type=None, luxury_category=None, sector=None):
        frame = self.frame
        for key, value in [('property_type', property_type), ('luxury_category', luxury_category), ('sector', sector)]:
            if value is not None:
                frame = frame.loc[frame[key].eq(value)]
        return frame

    def meta(self, frame, filters):
        return {'source': self.source_name, 'source_sha256': self.source_hash,
                'dataset_rows': len(self.frame), 'filtered_rows': len(frame),
                'filters': dict(zip(['property_type', 'luxury_category', 'sector'], filters)),
                'price_unit': 'crore', 'area_unit': 'sqft', 'snapshot': True,
                'time_series_available': False}

    @staticmethod
    def value(series, method):
        return round(float(getattr(series, method)()), 4) if len(series) else None

    @staticmethod
    def sector_stats(frame):
        rows = []
        for sector, group in frame.groupby('sector', sort=True):
            rows.append({'sector': sector, 'listing_count': len(group),
                'avg_price_cr': round(float(group.price.mean()), 4),
                'median_price_cr': round(float(group.price.median()), 4),
                'price_variance_cr2': round(float(group.price.var(ddof=0)), 6),
                'avg_price_per_sqft_inr': round(float(group.price_per_sqft_inr.mean()), 2),
                'median_price_per_sqft_inr': round(float(group.price_per_sqft_inr.median()), 2)})
        return rows

    @lru_cache(maxsize=128)
    def aggregate(self, kind, property_type=None, luxury_category=None, sector=None, sort_by='volume', limit=20):
        frame = self.select(property_type, luxury_category, sector)
        meta = self.meta(frame, (property_type, luxury_category, sector))
        if kind == 'kpis':
            luxury = frame.loc[frame.luxury_category.eq('Luxury')]
            top = sorted(luxury.groupby('sector').size().items(), key=lambda x: (-x[1], x[0]))
            return {'meta': meta, 'total_listings': len(frame),
                'sector_count': int(frame.sector.nunique()),
                'avg_price_cr': self.value(frame.price, 'mean'),
                'median_price_per_sqft_inr': self.value(frame.price_per_sqft_inr, 'median'),
                'top_luxury_sector': {'sector': top[0][0], 'listing_count': int(top[0][1])} if top else None,
                'top_luxury_definition': 'Sector with the most Luxury-tier dataset listings; alphabetical tie-break.',
                'avg_price_by_property_type': [{'property_type': key, 'avg_price_cr': self.value(group.price, 'mean'),
                    'listing_count': len(group)} for key, group in frame.groupby('property_type', sort=True)]}
        if kind in ['sectors', 'geospatial']:
            rows = self.sector_stats(frame)
            if kind == 'sectors':
                key = {'volume': 'listing_count', 'median_price': 'median_price_cr', 'avg_price': 'avg_price_cr'}[sort_by]
                return {'meta': meta, 'sort_by': sort_by, 'sectors': sorted(rows, key=lambda x: (-x[key], x['sector']))[:limit]}
            mapped, unmapped = [], []
            for row in rows:
                location = self.resolve_sector(row['sector']) if self.geo['coordinates'] else None
                if location and location['resolution'] != 'city_fallback':
                    mapped.append({**row, **location})
                else:
                    unmapped.append(row['sector'])
            return {'meta': meta, 'sectors': mapped, 'unmapped_sectors': unmapped,
                'resolution_counts': dict(Counter(row['resolution'] for row in mapped)),
                'approximate_sectors': [row['sector'] for row in mapped if row['resolution'] != 'sector_polygon'],
                'unresolved_location_labels': [row['sector'] for row in mapped if row['resolution'] == 'city_fallback'],
                'display_coverage_percent': round(100 * len(mapped) / len(rows), 2) if rows else None,
                'mapped_listings': sum(row['listing_count'] for row in mapped),
                'coordinate_source': {**{k: v for k, v in self.geo.items() if k not in ['coordinates', 'query']},
                    'fallback_reference': {k: v for k, v in self.fallback_geo.items() if k != 'coordinates'}},
                'coordinate_note': 'Sector/locality reference points. Ambiguous labels without verified coordinates are listed as unmapped, never plotted at invented locations.'}
        if kind == 'floor-price-density':
            return {'meta': meta, 'groups': [{'floor_category': category, 'property_type': kind,
                **self.price_summary(frame.loc[frame.floor_category.eq(category) & frame.property_type.eq(kind)])}
                for category in ['Low-Rise', 'Mid-Rise', 'High-Rise']
                for kind in ['flat', 'house'] if property_type is None or kind == property_type]}
        if kind == 'utility-room-premium':
            rows = []
            for (kind, bhk), cohort in frame.groupby(['property_type', 'bedRoom'], sort=True):
                for room in ['servant room', 'store room']:
                    without = cohort.loc[cohort[room].eq(0)]
                    with_room = cohort.loc[cohort[room].eq(1)]
                    sufficient = len(without) > 0 and len(with_room) > 0
                    base = float(without.price.median()) if len(without) else None
                    median_with = float(with_room.price.median()) if len(with_room) else None
                    density_delta = float(with_room.price_per_sqft_inr.median() - without.price_per_sqft_inr.median()) if sufficient else None
                    rows.append({'property_type': kind, 'bhk': int(bhk), 'room': room,
                        'without_room': self.price_summary(without), 'with_room': self.price_summary(with_room),
                        'observed_price_difference_cr': round(median_with - base, 4) if sufficient else None,
                        'observed_difference_percent': round((median_with / base - 1) * 100, 2) if sufficient else None,
                        'observed_density_difference_inr': round(density_delta, 2) if sufficient else None,
                        'comparison_available': sufficient, 'small_sample': min(len(without), len(with_room)) < 5})
            return {'meta': meta, 'groups': rows,
                'interpretation': 'Difference of medians within property type and BHK, not causal value added. Area, location, age and luxury remain uncontrolled.',
                'small_sample_definition': 'Fewer than 5 listings in either comparison group.'}
        if kind == 'balcony-distribution':
            return {'meta': meta, 'groups': [{'balcony': balcony, 'property_type': kind,
                **self.price_summary(frame.loc[frame.balcony.astype(str).eq(balcony) & frame.property_type.eq(kind)])}
                for balcony in ['0', '1', '2', '3', '3+']
                for kind in ['flat', 'house'] if property_type is None or kind == property_type]}
        if kind == 'luxury-vs-possession':
            tiers = ['Standard', 'Premium', 'Luxury']
            ages = ['New Property', 'Relatively New', 'Moderately Old', 'Old Property', 'Under Construction']
            return {'meta': meta, 'luxury_categories': tiers, 'age_categories': ages,
                'cells': [{'luxury_category': tier, 'agePossession': age,
                    **self.price_summary(frame.loc[frame.luxury_category.eq(tier) & frame.agePossession.eq(age)])}
                    for tier in tiers for age in ages]}
        if kind == 'correlations':
            def distribution(column, order):
                result = []
                for category in order:
                    group = frame.loc[frame[column].eq(category)]
                    if group.empty:
                        continue
                    result.append({'category': category, 'listing_count': len(group),
                        'mean_price_cr': self.value(group.price, 'mean'),
                        'median_price_cr': self.value(group.price, 'median'),
                        'q1_price_cr': round(float(group.price.quantile(.25)), 4),
                        'q3_price_cr': round(float(group.price.quantile(.75)), 4),
                        'min_price_cr': self.value(group.price, 'min'), 'max_price_cr': self.value(group.price, 'max'),
                        'by_property_type': [{'property_type': key, 'median_price_cr': self.value(part.price, 'median'),
                            'listing_count': len(part)} for key, part in group.groupby('property_type', sort=True)]})
                return result
            scatter = [{'row_id': int(index), 'built_up_area': float(row.built_up_area),
                'price_cr': float(row.price), 'property_type': row.property_type,
                'furnishing_type': row.furnishing_type, 'sector': row.sector}
                for index, row in frame.iterrows()]
            correlation = float(frame.price.corr(frame.built_up_area)) if len(frame) > 1 and frame.price.nunique() > 1 and frame.built_up_area.nunique() > 1 else None
            return {'meta': meta, 'price_vs_area': scatter, 'price_area_pearson_r': correlation,
                'luxury_distribution': distribution('luxury_category', ['Standard', 'Premium', 'Luxury']),
                'age_distribution': distribution('agePossession', ['New Property', 'Relatively New', 'Moderately Old', 'Old Property', 'Under Construction']),
                'floor_distribution': distribution('floor_category', ['Low-Rise', 'Mid-Rise', 'High-Rise']),
                'furnishing_types': sorted(self.frame.furnishing_type.unique().tolist())}
        raise ValueError('Unsupported analytics aggregation')


def filters(request: Request, property_type: PropertyType | None = None,
            luxury_category: LuxuryTier | None = None,
            sector: Annotated[str | None, Query(min_length=1, max_length=200)] = None):
    engine = getattr(request.app.state, 'analytics', None)
    if engine is None:
        raise HTTPException(503, 'Analytics dataset is not ready')
    if sector is not None and sector not in set(engine.frame.sector):
        raise HTTPException(422, 'Unsupported sector')
    return engine, property_type, luxury_category, sector


@router.get('/kpis')
def kpis(selection=Depends(filters)):
    engine, *values = selection
    return engine.aggregate('kpis', *values)


@router.get('/geospatial')
def geospatial(selection=Depends(filters)):
    engine, *values = selection
    return engine.aggregate('geospatial', *values)


@router.get('/sector-breakdown')
def sector_breakdown(selection=Depends(filters), sort_by: Literal['volume', 'median_price', 'avg_price'] = 'volume',
                     limit: Annotated[int, Query(ge=1, le=115)] = 20):
    engine, *values = selection
    return engine.aggregate('sectors', *values, sort_by=sort_by, limit=limit)


@router.get('/feature-correlations')
def feature_correlations(selection=Depends(filters)):
    engine, *values = selection
    return engine.aggregate('correlations', *values)


@router.get('/floor-price-density')
def floor_price_density(selection=Depends(filters)):
    engine, *values = selection
    return engine.aggregate('floor-price-density', *values)


@router.get('/utility-room-premium')
def utility_room_premium(selection=Depends(filters)):
    engine, *values = selection
    return engine.aggregate('utility-room-premium', *values)


@router.get('/balcony-distribution')
def balcony_distribution(selection=Depends(filters)):
    engine, *values = selection
    return engine.aggregate('balcony-distribution', *values)


@router.get('/luxury-vs-possession')
def luxury_vs_possession(selection=Depends(filters)):
    engine, *values = selection
    return engine.aggregate('luxury-vs-possession', *values)
