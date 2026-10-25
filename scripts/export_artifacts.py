"""Export notebook 09's champion; run with .venv/Scripts/python scripts/export_artifacts.py.

Requires pandas, numpy, scipy, scikit-learn, category-encoders, xgboost, joblib.
Writes a NEW prediction bundle directory, never overwriting an existing bundle.
The JSON model returns log1p(crores): inference MUST apply expm1, then * 1e7.
"""
import argparse
from contextlib import contextmanager
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import shutil
import uuid

import category_encoders as ce
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer, TransformedTargetRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
FEATURE_COLUMNS = [
    'property_type', 'sector', 'bedRoom', 'bathroom', 'balcony',
    'agePossession', 'built_up_area', 'servant room', 'store room',
    'furnishing_type', 'floor_category', 'luxury_category',
]
NUMERIC = ['bedRoom', 'bathroom', 'built_up_area', 'servant room', 'store room']
CATEGORICAL = ['property_type', 'sector', 'balcony', 'agePossession',
               'furnishing_type', 'luxury_category', 'floor_category']
BEST_PARAMS = dict(
    n_estimators=500, learning_rate=0.04012240724057226, max_depth=7,
    subsample=0.7448228969369078, colsample_bytree=0.8027275970188548,
    reg_alpha=0.10847831041061963, reg_lambda=0.01840970025222743,
    random_state=42, n_jobs=-1,
)


@contextmanager
def staging_directory(parent):
    # TemporaryDirectory applies a private Windows ACL. A normal sibling
    # directory inherits project permissions, which survive the final rename.
    staging = parent / f'propvision-export-{uuid.uuid4().hex}'
    staging.mkdir()
    try:
        yield staging
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def make_pipeline():
    # Deliberately preserve repeated sector/age representations from notebook 09.
    # TargetEncoder sees RAW crore y because it precedes the target wrapper.
    preprocessor = ColumnTransformer([
        ('num', StandardScaler(), NUMERIC),
        ('cat', OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1),
         CATEGORICAL),
        ('cat1', OneHotEncoder(drop='first', sparse_output=False,
                               handle_unknown='ignore'), ['agePossession']),
        ('target_enc', ce.TargetEncoder(), ['sector']),
    ], remainder='passthrough')
    return Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', TransformedTargetRegressor(
            regressor=XGBRegressor(**BEST_PARAMS), func=np.log1p, inverse_func=np.expm1)),
    ])


def read_data(source):
    frame = pd.read_csv(source, dtype={c: str for c in CATEGORICAL})
    expected = set(FEATURE_COLUMNS + ['price'])
    if set(frame.columns) != expected or len(frame.columns) != len(expected):
        raise ValueError(f'Expected exactly {sorted(expected)}; got {list(frame.columns)}')
    if frame.empty or frame.isna().any().any():
        raise ValueError('Final processed dataset must be nonempty with no missing values')
    for c in NUMERIC + ['price']:
        frame[c] = pd.to_numeric(frame[c], errors='raise')
    if not np.isfinite(frame[NUMERIC + ['price']].to_numpy()).all():
        raise ValueError('Numeric values must be finite')
    if (frame[['bedRoom', 'bathroom', 'built_up_area', 'price']] <= 0).any().any():
        raise ValueError('Room counts, area and price must be positive')
    for c in ['bedRoom', 'bathroom', 'servant room', 'store room']:
        if (frame[c] % 1 != 0).any():
            raise ValueError(f'{c} must be integral')
    for c in ['servant room', 'store room']:
        if not frame[c].isin([0, 1]).all():
            raise ValueError(f'{c} must be binary')
    for c in CATEGORICAL:
        if frame[c].str.strip().eq('').any():
            raise ValueError(f'{c} contains blank categories')
    return frame


def export(source, output):
    if output.exists():
        raise FileExistsError(f'Choose a new --output-dir; directory already exists: {output}')
    frame = read_data(source)
    X, y = frame[FEATURE_COLUMNS], frame['price']
    train_x, test_x, train_y, test_y = train_test_split(
        X, y, test_size=0.2, random_state=42)
    evaluation = make_pipeline().fit(train_x, train_y)
    predicted = evaluation.predict(test_x)
    metrics = {'mae_crore': float(mean_absolute_error(test_y, predicted)),
               'r2_price_space': float(r2_score(test_y, predicted)),
               'train_rows': len(train_x), 'test_rows': len(test_x)}
    print('Holdout evaluation (split overlaps tuning data; not independent):')
    print(json.dumps(metrics, indent=2), flush=True)
    # Evaluate before full-data fitting; export matched preprocessing/model pair.
    pipeline = make_pipeline().fit(X, y)
    preprocessor = pipeline.named_steps['preprocessor']
    model = pipeline.named_steps['regressor'].regressor_
    names = preprocessor.get_feature_names_out().tolist()

    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    versions = {p: importlib.metadata.version(p) for p in
                ['numpy', 'pandas', 'scipy', 'scikit-learn', 'category-encoders', 'xgboost', 'joblib']}
    metadata = dict(
        schema_version='propvision-tuned-v1', source=str(source), source_sha256=source_hash,
        notebook='notebooks/09_hyperparameter_tuning.ipynb', feature_columns=FEATURE_COLUMNS,
        numeric_columns=NUMERIC, categorical_columns=CATEGORICAL,
        categories={c: sorted(frame[c].unique().tolist()) for c in CATEGORICAL},
        feature_dtypes={c: str(X[c].dtype) for c in FEATURE_COLUMNS},
        transformed_feature_names=names, transformed_feature_count=len(names),
        hyperparameters=BEST_PARAMS, resolved_model_parameters={k: (None if isinstance(v, float) and not np.isfinite(v) else v)
                                   for k, v in model.get_params().items()},
        target_transform='log1p', target_unit='crore',
        prediction_to_inr='expm1(model.predict(preprocessor.transform(X))) * 10000000',
        rows=len(frame), evaluation=metrics,
        exported_fit='all rows after holdout evaluation',
        evaluation_limitation='Optuna used all rows; split is not an independent final test.',
        python_version=platform.python_version(), package_versions=versions,
        example_payload=json.loads(X.iloc[[0]].to_json(orient='records'))[0],
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    # Stage and verify serialization before publishing a complete bundle.
    with staging_directory(output.parent) as staging:
        joblib.dump(preprocessor, staging / 'preprocessor.pkl', compress=3)
        model.save_model(staging / 'xgboost_model.json')
        loaded_preprocessor = joblib.load(staging / 'preprocessor.pkl')
        loaded_model = XGBRegressor()
        loaded_model.load_model(staging / 'xgboost_model.json')
        sample = X.iloc[:20]
        restored = np.expm1(loaded_model.predict(loaded_preprocessor.transform(sample)))
        np.testing.assert_allclose(restored, pipeline.predict(sample), rtol=1e-6)
        if loaded_model.n_features_in_ != len(names):
            raise AssertionError('Transformed model dimensions differ')
        metadata['artifact_sha256'] = {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in staging.iterdir()}
        (staging / 'model_metadata.json').write_text(
            json.dumps(metadata, indent=2, allow_nan=False), encoding='utf-8')
        (staging / 'requirements-lock.txt').write_text(
            '\n'.join(f'{p}=={v}' for p, v in versions.items()) + '\n', encoding='utf-8')
        staging.rename(output)
    print(f'Exported and reload-verified {len(frame)} rows, {len(names)} model features to {output}')
    print('Prediction payload:')
    print(json.dumps(metadata['example_payload'], indent=2))
    print('Inference: ' + metadata['prediction_to_inr'])
    print('Blueprint and alignment: docs/PRODUCTION_TECHNICAL_SPEC.md')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=ROOT / 'data/processed/gurgaon_properties_post_feature_selection_v2.csv')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/tuned_v1')
    args = parser.parse_args()
    export(args.data.resolve(), args.output_dir.resolve())
