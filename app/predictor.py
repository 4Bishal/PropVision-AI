"""Load CV residual statistics bound to the serving model and preprocessing."""
import hashlib
import json
from pathlib import Path
import numpy as np


def load_valuation_metrics(directory):
    directory = Path(directory)
    path = directory / 'valuation_metrics.json'
    if not path.exists():
        return None  # Older prediction-only bundles explicitly have no interval.
    metrics = json.loads(path.read_text(encoding='utf-8'))
    values = [metrics[k] for k in ('q10_residual', 'q90_residual', 'mae_percentage')]
    if not all(isinstance(v, (int, float)) and not isinstance(v, bool) and np.isfinite(v) for v in values):
        raise ValueError('Invalid valuation statistics')
    if values[0] > values[1] or values[2] < 0:
        raise ValueError('Invalid residual quantile order or MAE')
    for file, key in [('xgboost_model.json', 'model_sha256'), ('preprocessor.pkl', 'preprocessor_sha256')]:
        if metrics.get(key) != hashlib.sha256((directory / file).read_bytes()).hexdigest():
            raise ValueError('Valuation statistics do not match serving artifacts')
    return metrics


def empirical_interval(pred_log, metrics):
    if metrics is None:
        return None
    with np.errstate(over='ignore', invalid='ignore'):
        bounds = np.expm1(np.asarray([metrics['q10_residual'], metrics['q90_residual']]) + pred_log) * 1e7
    if not np.isfinite(bounds).all():
        raise ValueError('Invalid empirical bounds')
    # Physical prices cannot be negative, including at the low end of the model.
    bounds = np.maximum(bounds, 0)
    return dict(lower_bound=round(float(bounds[0]), 2), upper_bound=round(float(bounds[1]), 2),
                confidence_level='80% Empirical Prediction Interval', mae_pct=metrics['mae_percentage'],
                q90_residual=metrics['q90_residual'])
