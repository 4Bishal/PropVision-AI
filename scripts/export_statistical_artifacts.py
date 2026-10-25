"""Export CV residual statistics and price-relevance weighted recommendation features.
Run from root: .venv/Scripts/python -m scripts.export_statistical_artifacts
"""
import hashlib
import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold
from scripts.export_artifacts import make_pipeline, read_data, FEATURE_COLUMNS

ROOT = Path(__file__).resolve().parents[1]


def export(directory=ROOT / 'artifacts/tuned_v1', source=ROOT / 'data/processed/gurgaon_properties_post_feature_selection_v2.csv'):
    directory, source = Path(directory), Path(source)
    frame = read_data(source)
    x, y = frame[FEATURE_COLUMNS], frame.price.to_numpy()
    predictions = np.empty(len(frame))
    importances = []
    for train, test in KFold(5, shuffle=True, random_state=42).split(x):
        pipeline = make_pipeline()
        pipeline.set_params(regressor__regressor__n_jobs=1)
        pipeline.fit(x.iloc[train], y[train])
        predictions[test] = pipeline.predict(x.iloc[test])
        preprocessor = pipeline.named_steps['preprocessor']
        weights = pipeline.named_steps['regressor'].regressor_.feature_importances_
        # Aggregate repeated sector/age representations to their raw feature.
        raw_weights = dict.fromkeys(FEATURE_COLUMNS, 0.0)
        for name, weight in zip(preprocessor.get_feature_names_out(), weights):
            suffix = name.split('__', 1)[1]
            raw = next(c for c in sorted(FEATURE_COLUMNS, key=len, reverse=True)
                       if suffix == c or suffix.startswith(c + '_'))
            raw_weights[raw] += float(weight)
        importances.append(raw_weights)
    residuals = np.log1p(y) - np.log1p(predictions)
    provenance = dict(source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        model_sha256=hashlib.sha256((directory / 'xgboost_model.json').read_bytes()).hexdigest(),
        preprocessor_sha256=hashlib.sha256((directory / 'preprocessor.pkl').read_bytes()).hexdigest(),
        rows=len(frame), cv_folds=5, random_state=42,
        limitation='Hyperparameters previously tuned on this dataset; CV coverage is nominal, not independent validation.')
    metrics = dict(schema_version='propvision-valuation-v1', **provenance,
        q10_residual=float(np.quantile(residuals, .1)), q90_residual=float(np.quantile(residuals, .9)),
        mae_percentage=float(np.mean(abs(predictions - y) / y) * 100),
        residual_definition='log1p(actual_crore) - log1p(oof_prediction_crore)')
    artifact = joblib.load(directory / 'property_embeddings.pkl')
    raw_weights = {c: float(np.mean([v[c] for v in importances])) for c in FEATURE_COLUMNS}
    feature_weights = []
    names = artifact['feature_names']
    for name in names:
        suffix = name.split('__', 1)[1]
        raw = next(c for c in sorted(FEATURE_COLUMNS, key=len, reverse=True)
                   if suffix == c or suffix.startswith(c + '_'))
        count = sum(n.split('__', 1)[1] == raw or n.split('__', 1)[1].startswith(raw + '_') for n in names)
        feature_weights.append(raw_weights[raw] / count)
    artifact.update(schema_version='propvision-weighted-recommendations-v1',
        feature_importances=np.asarray(feature_weights), raw_feature_importances=raw_weights,
        defaults={c: (float(frame[c].median()) if pd.api.types.is_numeric_dtype(frame[c]) else frame[c].mode().iloc[0]) for c in FEATURE_COLUMNS},
        weighting='cosine after multiplying each feature by sqrt(importance); OHE importance divided across categories',
        importance_provenance=provenance, importance_target='XGBoost price relevance; not learned user preference',
        score_weights={'cosine': .75, 'price_proximity': .25})
    (directory / 'valuation_metrics.json').write_text(json.dumps(metrics, indent=2, allow_nan=False), encoding='utf-8')
    joblib.dump(artifact, directory / 'recommender_pipeline.pkl', compress=3)
    return metrics


if __name__ == '__main__':
    print(json.dumps(export(), indent=2))
