"""Load and verify a matched, trusted artifact bundle before serving requests."""
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

from .schemas import PredictionInput


@dataclass(frozen=True)
class Bundle:
    metadata: dict[str, Any]
    preprocessor: Any
    model: XGBRegressor
    columns: tuple[str, ...]
    categories: dict[str, frozenset[str]]


def load_bundle(directory: Path, threads: int = 1) -> Bundle:
    required = ['model_metadata.json', 'preprocessor.pkl', 'xgboost_model.json']
    missing = [name for name in required if not (directory / name).is_file()]
    if missing:
        raise RuntimeError(f'Missing artifacts in {directory}: {", ".join(missing)}')
    # Older exporter metadata contains NaN in XGBoost defaults; health must emit
    # valid JSON, so normalize those non-standard constants to null on read.
    metadata = json.loads((directory / required[0]).read_text(encoding='utf-8'),
                          parse_constant=lambda _: None)
    if (metadata['schema_version'] != 'propvision-tuned-v1'
            or metadata['target_transform'] != 'log1p'
            or metadata['target_unit'] != 'crore'):
        raise ValueError('Unsupported bundle schema or price transformation')
    for name in required[1:]:
        actual = hashlib.sha256((directory / name).read_bytes()).hexdigest()
        if actual != metadata['artifact_sha256'][name]:
            raise ValueError(f'Artifact checksum mismatch: {name}')
    # Only trusted local files: joblib deserialization can execute Python code.
    preprocessor = joblib.load(directory / 'preprocessor.pkl')
    model = XGBRegressor()
    model.load_model(directory / 'xgboost_model.json')
    model.set_params(n_jobs=threads)
    columns = tuple(metadata['feature_columns'])
    schema_columns = set(PredictionInput.model_json_schema()['properties'])
    if set(columns) != schema_columns or len(columns) != 12:
        raise ValueError('Request and bundle input schemas differ')
    if tuple(preprocessor.feature_names_in_) != columns:
        raise ValueError('Preprocessor raw feature order differs from metadata')
    names = preprocessor.get_feature_names_out().tolist()
    if (names != metadata['transformed_feature_names']
            or len(names) != metadata['transformed_feature_count']
            or len(names) != model.n_features_in_):
        raise ValueError('Preprocessor and model transformed features differ')
    categories = {c: frozenset(v) for c, v in metadata['categories'].items()}
    ordinal = preprocessor.named_transformers_['cat']
    for c, values in zip(metadata['categorical_columns'], ordinal.categories_):
        if categories[c] != frozenset(values):
            raise ValueError(f'Category vocabulary mismatch: {c}')
    sample = PredictionInput.model_validate(metadata['example_payload'])
    raw = pd.DataFrame([sample.model_dump(by_alias=True)], columns=columns)
    prediction = np.asarray(model.predict(preprocessor.transform(raw))).reshape(-1)
    with np.errstate(over='ignore', invalid='ignore'):
        price = np.expm1(prediction.astype(float)) * 10_000_000
    if price.size != 1 or not np.isfinite(price).all() or (price < 0).any():
        raise ValueError('Startup prediction smoke check failed')
    return Bundle(metadata, preprocessor, model, columns, categories)
