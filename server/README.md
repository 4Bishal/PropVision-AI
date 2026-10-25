# Express prediction backend

```powershell
npm.cmd ci
# First setup only: copy .env.example to .env and configure MONGO_URI.
npm.cmd run dev
```

Node 22.15+; default port 5000. The application reads .env relative to server/, connects to MongoDB before accepting traffic, then serves:

- POST /api/predict: exact 12-feature JSON, numeric fields as numbers; forwards to FastAPI /predict-price and returns its INR response without another transformation.
- GET /api/schema-options: categories and input order from FastAPI /health, cached for 60 seconds.

FASTAPI_URL defaults to http://localhost:8000; use http://127.0.0.1:8000 if Python listens only on IPv4. FASTAPI_TIMEOUT_MS defaults to 10000. Property.js remains the general MongoDB listing model, but prediction does not read or write listings. No optional query log is enabled.

Input/category errors return 422; ML outages 503; timeout 504; invalid or failed upstream responses 502. Unexpected errors are sanitized and carry a request ID. JSON is limited to 32 KB, CORS is enabled without credentials, and rate limits apply per process. Production deployments must configure authentication and their proxy topology as appropriate. MongoDB index creation is disabled with NODE_ENV=production; apply listing indexes through deployment tooling when listing ingestion is used.

`npm.cmd test` exercises routing, validation, schema caching, errors, HTTP transport and the retained Mongoose schema. Recommendation routes, helpers and listing hydration are removed. Graceful shutdown drains requests and disconnects MongoDB.

Analytics GET routes are mounted at /api/analytics/{kpis,geospatial,sector-breakdown,feature-correlations}; filters are forwarded to FastAPI with the same timeout/error handling. GET /api/health bypasses schema caching and reports Express and FastAPI status separately. See ../docs/ANALYTICS_MODULE.md.
