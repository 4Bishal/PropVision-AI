"""Contextual recommendations using the saved embedding feature space.

Context price/budget bounds are INR; dataset prices are crores. Integer IDs
are zero-based CSV row positions; cards expose the artifact's stable string IDs.
"""
from functools import lru_cache
import hashlib
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/processed/gurgaon_properties_post_feature_selection_v2.csv'
ARTIFACT = ROOT / 'artifacts/tuned_v1/recommender_pipeline.pkl'


class RecommendationEngine:
    def __init__(self, data_path=DATA, artifact_path=ARTIFACT):
        source = Path(data_path)
        self.frame = pd.read_csv(source)
        artifact = joblib.load(artifact_path)  # Trusted local bundle only.
        if hashlib.sha256(source.read_bytes()).hexdigest() != artifact['source_sha256']:
            raise ValueError('Recommendation dataset checksum mismatch')
        original_path = Path(artifact_path).with_name('property_embeddings.pkl')
        original = joblib.load(original_path)
        if (original['source_sha256'] != artifact['source_sha256']
                or original['feature_names'] != artifact['feature_names']
                or original['matrix'].shape != artifact['matrix'].shape
                or (original['matrix'] != artifact['matrix']).nnz):
            raise ValueError('Recommender pipeline differs from original embeddings')
        if not original['properties'].property_id.equals(artifact['properties'].property_id):
            raise ValueError('Recommender property IDs differ from original embeddings')
        self.properties = artifact['properties'].reset_index(drop=True)
        if artifact.get('schema_version') != 'propvision-weighted-recommendations-v1':
            raise ValueError('Unsupported recommender pipeline schema')
        self.matrix = artifact['matrix']
        weights = np.asarray(artifact['feature_importances'], dtype=float)
        if (weights.shape != (self.matrix.shape[1],) or not np.isfinite(weights).all()
                or (weights < 0).any() or weights.sum() <= 0):
            raise ValueError('Invalid learned recommendation feature importances')
        self.feature_scale = np.sqrt(weights)
        self.weighted_matrix = self.matrix.multiply(self.feature_scale).tocsr() if hasattr(self.matrix, 'multiply') else self.matrix * self.feature_scale
        self.score_weights = artifact['score_weights']
        if (set(self.score_weights) != {'cosine', 'price_proximity'}
                or not all(np.isfinite(v) and v >= 0 for v in self.score_weights.values())
                or not np.isclose(sum(self.score_weights.values()), 1)):
            raise ValueError('Invalid recommendation score weights')
        self.transformer = artifact['transformer']
        if (self.matrix.shape != (len(self.frame), len(artifact['feature_names']))
                or len(self.properties) != len(self.frame)
                or list(self.transformer.get_feature_names_out()) != list(artifact['feature_names'])):
            raise ValueError('Recommendation feature alignment mismatch')
        columns = list(self.transformer.feature_names_in_)
        pd.testing.assert_frame_equal(self.frame[columns], self.properties[columns], check_dtype=False)
        self.sector_rates = (self.properties.assign(rate=self.properties.price / self.properties.built_up_area)
                             .groupby('sector').rate.mean().to_dict())
        self.sector_medians = (self.properties.assign(rate=self.properties.price / self.properties.built_up_area)
                               .groupby('sector').rate.median().to_dict())
        self.sector_tiers = {}
        self.ids = {str(value): i for i, value in enumerate(self.properties.property_id)}
        self.defaults = artifact['defaults']
        if set(self.defaults) != set(columns):
            raise ValueError('Recommendation defaults do not match feature schema')

    def _cosine(self, query):
        try:
            weighted_query = query.multiply(self.feature_scale) if hasattr(query, 'multiply') else query * self.feature_scale
            scores = cosine_similarity(weighted_query, self.weighted_matrix).ravel()
        except (ValueError, FloatingPointError):
            scores = np.zeros(len(self.frame))
        return np.clip(np.nan_to_num(scores, nan=0.0, posinf=0.0, neginf=0.0), -1, 1)

    def _cards(self, scores, mask, top_n, specs=None, vector_scores=None):
        indices = np.flatnonzero(mask)
        indices = indices[np.argsort(-scores[indices], kind='stable')[:top_n]]
        result = []
        for i in indices:
            row = self.properties.iloc[i]
            price = float(row.price)
            tags = [f'{int(row.bedRoom)} BHK', str(row.luxury_category), str(row.furnishing_type)]
            tags += [name.title() for name in ('servant room', 'store room') if row[name] == 1]
            badges = []
            if specs:
                if specs.get('sector') and str(row.sector).casefold() == str(specs['sector']).strip().casefold():
                    badges.append('Same sector')
                if specs.get('price') and price <= specs['price']:
                    badges.append('Within budget')
                if specs.get('bedRoom') == row.bedRoom:
                    badges.append('Matching BHK')
                if specs.get('built_up_area') and row.built_up_area >= specs['built_up_area']:
                    badges.append('More space')
                if specs.get('luxury_category') == row.luxury_category:
                    badges.append('Matching luxury category')
            amount, unit = (price / 1e7, 'Cr') if price >= 1e7 else (price / 1e5, 'Lakhs')
            result.append(dict(property_id=str(row.property_id), row_id=int(i),
                               vector_match_percentage=round(float(vector_scores[i]) * 100, 1) if vector_scores is not None else None,
                               match_percentage=round(float(np.clip(scores[i], 0, 1)) * 100, 1),
                               sector_avg_price_per_sqft=float(self.sector_rates[row.sector]),
                               sector_median_price_per_sqft=float(self.sector_medians[row.sector]),
                               sector_tier=self.sector_tiers.get(row.sector),
                               agePossession=str(row.agePossession), balcony=str(row.balcony),
                               furnishing_type=str(row.furnishing_type), luxury_score=None,
                               amenities={'Servant room': bool(row['servant room']), 'Store room': bool(row['store room'])},
                               price=price, price_inr=price, price_crore=price / 1e7,
                               formatted_price=f'₹{amount:g} {unit}',
                               area=float(row.built_up_area), built_up_area=float(row.built_up_area),
                               sector=str(row.sector), bedRoom=int(row.bedRoom), bathroom=int(row.bathroom),
                               property_type=str(row.property_type), floor_category=str(row.floor_category),
                               luxury_category=str(row.luxury_category),
                               key_feature_tags=tags, comparison_highlights=badges))
        return result

    def get_similar_properties(self, property_id, top_n=6, max_price_diff_pct=0.35):
        self._validate_top_n(top_n)
        if not np.isfinite(max_price_diff_pct) or max_price_diff_pct < 0:
            raise ValueError('max_price_diff_pct must be finite and nonnegative')
        key = str(property_id)
        index = self.ids.get(key)
        if index is None and not isinstance(property_id, bool) and key.isdecimal():
            index = int(key)
        if index is None or not 0 <= index < len(self.frame):
            raise KeyError(property_id)
        cosine = self._cosine(self.matrix[index:index + 1])
        prices = self.properties.price.to_numpy(dtype=float)
        target = prices[index]
        penalty = np.divide(abs(prices - target), np.maximum(prices, target),
                            out=np.zeros_like(prices), where=np.maximum(prices, target) > 0)
        scores = self.score_weights['cosine'] * cosine + self.score_weights['price_proximity'] * (1 - penalty)
        mask = penalty <= max_price_diff_pct
        mask[index] = False
        return self._cards(scores, mask, top_n, vector_scores=cosine)

    @staticmethod
    def _validate_top_n(top_n):
        if isinstance(top_n, bool) or not isinstance(top_n, int) or not 1 <= top_n <= 100:
            raise ValueError('top_n must be an integer between 1 and 100')

    def get_recommendations_by_search_context(self, specs, top_n=6):
        self._validate_top_n(top_n)
        specs = {k: v for k, v in specs.items() if v is not None}
        specs = dict(specs)
        if 'area' in specs:
            specs.setdefault('built_up_area', specs.pop('area'))
        if 'BHK' in specs:
            specs.setdefault('bedRoom', specs.pop('BHK'))
        if 'budget' in specs:
            specs.setdefault('max_price', specs.pop('budget'))
        for name in ('price', 'min_price', 'max_price', 'bedRoom', 'built_up_area'):
            if name in specs and (not np.isfinite(specs[name]) or specs[name] <= 0):
                raise ValueError(f'{name} must be finite and positive')
        if specs.get('min_price', 0) > specs.get('max_price', float('inf')):
            raise ValueError('min_price exceeds max_price')
        query = dict(self.defaults)
        mask = np.ones(len(self.frame), dtype=bool)
        for name in self.transformer.feature_names_in_:
            if name in specs:
                value = specs[name]
                if isinstance(value, str):
                    matches = [v for v in self.frame[name].unique() if str(v).casefold() == value.strip().casefold()]
                    if not matches:
                        return []
                    value = matches[0]
                query[name] = value
        if 'sector' in specs:
            mask &= self.frame.sector.eq(query['sector']).to_numpy()
        prices = self.properties.price.to_numpy(dtype=float)
        mask &= prices >= specs.get('min_price', 0)
        mask &= prices <= specs.get('max_price', float('inf'))
        scores = self._cosine(self.transformer.transform(pd.DataFrame([query])))
        vector_scores = scores.copy()
        if 'price' in specs:
            penalty = abs(prices - specs['price']) / np.maximum(prices, specs['price'])
            scores = self.score_weights['cosine'] * scores + self.score_weights['price_proximity'] * (1 - penalty)
        return self._cards(scores, mask, top_n, specs, vector_scores=vector_scores)


@lru_cache(maxsize=1)
def get_engine(directory=ARTIFACT.parent):
    return RecommendationEngine(artifact_path=Path(directory) / 'recommender_pipeline.pkl')


def get_similar_properties(property_id: int | str, top_n: int = 6, max_price_diff_pct: float = 0.35):
    return get_engine().get_similar_properties(property_id, top_n, max_price_diff_pct)


def get_recommendations_by_search_context(specs: dict, top_n: int = 6):
    return get_engine().get_recommendations_by_search_context(specs, top_n)
