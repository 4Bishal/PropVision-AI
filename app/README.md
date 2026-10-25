# FastAPI predictor

Run from repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

GET /health returns readiness and JSON-safe metadata. POST /predict-price accepts the exact 12 raw features in docs/PRODUCTION_TECHNICAL_SPEC.md. The sole model source is artifacts/tuned_v1; only preprocessor.pkl, xgboost_model.json and model_metadata.json are loaded. Prediction artifacts are checksum-verified before deserialization; original unused bundle files are preserved.

ARTIFACT_DIR can override the bundle directory. MODEL_THREADS defaults to 1. Unsupported categories and invalid numeric inputs return 422; internal inference failures return sanitized 500 responses. Predictions apply expm1 to log1p(crores), then multiply by 10,000,000 for INR. Open /docs for the generated request schema.

Run Python tests from the root with `.venv/Scripts/python -m pytest tests -q`. Recommendation routes and runtime loading are removed.

Snapshot analytics are registered in app/analytics.py at /analytics/{kpis,geospatial,sector-breakdown,feature-correlations}. The CSV and separate sector coordinate reference are loaded at startup; no model artifact is changed. See docs/ANALYTICS_MODULE.md for contracts and provenance.

### Contextual recommendations

`POST /api/v1/recommend/similar` accepts `property_id` (zero-based integer row
or stable string ID), `top_n` (1–100, default 6), and optional
`max_price_diff_pct` (default 0.35). Results exclude the source row and enforce
that maximum symmetric price deviation before ranking by 75% cosine similarity
and 25% price proximity.

`POST /api/v1/recommend/contextual` accepts optional `sector`, `price`, `bedRoom`,
`built_up_area`, `luxury_category`, `budget`, `min_price`, `max_price`, and `top_n`.
Prices and budget bounds are INR; area is square feet. `price` is a soft ranking
preference; sector and budget bounds are hard filters. Missing embedding features
use dataset medians/modes through the artifact's fitted transformer. Unknown
categories or unsatisfiable filters return an empty list. Match percentages are
ranking scores, not calibrated probabilities.

Cards include stable `property_id`, integer `row_id`, price in INR and crores,
`formatted_price`, area, sector, BHK, feature tags, and comparison highlights.
Unknown IDs return 404; invalid inputs return 422. Nonfinite cosine scores fall
back to zero similarity with deterministic price proximity ranking. Recommendation
artifacts load lazily, preserving support for prediction-only bundles; unavailable
recommendation artifacts return 503. The source checksum and feature alignment
are verified before recommendations are served.

### Statistical artifacts

Run `.venv/Scripts/python -m scripts.export_statistical_artifacts` from the root,
or execute `notebooks/04_content_based_recommender.ipynb`, to regenerate
`valuation_metrics.json` and `recommender_pipeline.pkl`. The serving model and
preprocessor are preserved. Five shuffled folds fit preprocessing on training rows
only. Residuals are `log1p(actual_crore) - log1p(out_of_fold_prediction_crore)`;
the saved 10th/90th quantiles produce nominal 80% empirical intervals. MAE
percentage is mean absolute percentage error on out-of-fold price predictions.
Hyperparameters were previously tuned on this dataset, so this is not independent
coverage validation. Negative physical lower bounds are clipped to zero.

Prediction responses retain the existing fields and add `predicted_price` (INR)
and `valuation_range`. Metrics are checked against model/preprocessor hashes.
Older prediction-only bundles return a null interval instead of invented bounds.
The frontend uses API bounds unchanged; its exploration slider does not recalibrate
the interval. Express validates and forwards the statistical fields.

The recommender loads the saved transformer, embeddings, defaults, score blend,
and learned feature importances from the new pipeline. CV XGBoost importances are
aggregated by raw feature and distributed across each one-hot feature group.
Weighted cosine multiplies vectors by the square root of those importances.
These weights learn price relevance, not user preferences. The original embeddings
remain untouched. Missing pipeline artifacts produce a recommendation 503.
