# PropVision application architecture

```text
React client
  | GET /api/schema-options, GET /api/analytics/*, GET /api/health, POST /api/predict
Express orchestration backend --- MongoDB connection and listing schema
  | GET /health, GET /analytics/*, POST /predict-price
FastAPI prediction service
  | immutable artifacts/tuned_v1/
Fitted preprocessor -> XGBoost -> expm1(log prediction) -> INR
```

## Ownership and contracts

- client/: user input, dynamic category dropdowns, numeric conversion, estimate display and connection/error states.
- server/: input/category validation, schema caching, bounded Axios requests and sanitized API errors. MongoDB is connected at startup; property listing storage remains available but is not on the prediction inference path.
- app/: authoritative prediction contract, startup integrity checks, reusable fitted transforms, model inference and inverse target transformation.
- artifacts/tuned_v1/: single authoritative trained bundle, preserved byte-for-byte. Legacy recommendation matrix/metadata inside that bundle are inactive and are not runtime dependencies.
- scripts/: explicit offline training/export. Existing bundle directories cannot be overwritten.
- notebooks/ and data/: retained research lineage, preprocessing stages and historical validation samples.

## Current routes

Express: GET /api/schema-options, GET /api/analytics/*, GET /api/health, POST /api/predict. FastAPI: GET /health, GET /analytics/*, POST /predict-price, generated OpenAPI documentation. Recommendation endpoints intentionally return 404. Analytics routes aggregate the processed CSV through app/analytics.py and server/routes/analytics.js. Analytics is the default homepage; Market Insights uses observed aggregates. See ANALYTICS_MODULE.md for the complete contract.

## Operational boundaries

Keep MONGO_URI server-side and keep .env files outside Git. VITE_API_URL is public. The default development services bind loopback. Model artifacts must be trusted before loading joblib files. Deployment should serve the browser bundle independently from the API processes. This repository cleanup does not rewrite Git history, change model weights, alter raw data or modify MongoDB contents.
