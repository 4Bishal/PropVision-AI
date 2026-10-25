# React real estate intelligence workspace

React + Vite + Tailwind CSS 4, with dynamic model fields, estimate results, light/dark modes and accessible loading/error handling.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open Vite's printed Local URL. Express must run on port 5000 and FastAPI on port 8000. The frontend calls GET /api/schema-options, GET /api/health, GET /api/analytics/* and POST /api/predict. Analytics is the default view; the predictor is available from the header. All seven category dropdowns are populated dynamically. The 12-field request preserves the notebook column names and converts numeric controls to JSON numbers.

The API defaults to http://localhost:5000. Copy .env.example to .env.local to set VITE_API_URL; restart Vite after changing it. VITE_* values are public browser configuration. Never put MONGO_URI here.

Connection indicators use uncached health polling every 30 seconds; schema options remain cached separately. Forms disable submission when schema options cannot be loaded and offer retry. The result shows the submitted input snapshot. Theme preference persists locally.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run preview
```

Build runs ESLint first with zero warnings allowed. Output is generated in dist/ and ignored by Git. Tailwind is configured through @tailwindcss/vite and @import "tailwindcss" in src/styles.css. No recommendation or placeholder property-card components remain. The Analytics/ directory provides Recharts charts and a lazy React Leaflet sector map. KPI and feature cards keep an even responsive grid; View Detail opens an accessible full-width modal with deferred charts and scrollable tables outside the grid. Map/chart canvases reserve 420px height.

The semantic palette lives in tailwind.config.js and is loaded explicitly through `@config "../tailwind.config.js"` in styles.css for Tailwind v4. Form surfaces stay pure white with slate text and neutral borders, the predict action uses warm amber, and the estimate panel uses forest emerald with white price text. Shared CSS references these config tokens through `theme()` so utility classes and component styles resolve to the same values.

Navigation now paints a matching analytics skeleton before initializing deferred visualization chunks. The dashboard retains its data, filters and map between visits; below-the-fold charts mount near the viewport. ThemeToggle updates root CSS variables independently of App, so a theme-only click does not re-render the dashboard. See ../docs/FRONTEND_PERFORMANCE.md for the verification evidence and browser profiling checklist; 60 FPS was not measured in this session.

See ../docs/ANALYTICS_MODULE.md for analytics API contracts and map attribution. Mapping dependencies: `npm.cmd install leaflet react-leaflet recharts`.

Market Insights is a dedicated lazy-loaded view in `src/components/Insights/`, with automated evidence-backed briefs, filterable sector report cards, price-distribution alerts, layout comparisons and buyer checklists. It calls the three `/api/insights/*` endpoints; restart FastAPI/Express after updating. See ../docs/MARKET_INSIGHTS.md for scoring definitions and interpretation limits. No extra dependencies or AI API keys are required.

The compact UI shares `DetailModal.jsx` and `SectorSearch.jsx` across Analytics/Insights. Sector search includes keyboard suggestions and exact-label selection. Insights uses six-card pagination; reports/checklists/valuation tables open in a bounded modal, with on-demand API requests. Analytics relationship charts also open from compact report cards rather than occupying long inline sections. No new packages are required.
