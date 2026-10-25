# Market Insights

Dedicated lazy-loaded Market Insights workspace, independent of the Analytics map/chart dashboard. No model training, external AI service, or database migration is required. The existing dataset is loaded once by AnalyticsEngine and shared read-only with InsightsEngine at FastAPI startup.

## API

| FastAPI | Express | Query parameters |
| --- | --- | --- |
| GET /insights/sector-rankings | GET /api/insights/sector-rankings | property_type: flat or house (optional) |
| GET /insights/summary-narratives | GET /api/insights/summary-narratives | property_type (optional) |
| GET /insights/valuation-alerts | GET /api/insights/valuation-alerts | property_type; sector: exact dataset label (optional) |

All responses include source filename/SHA256, selected and total row counts, filters, units, snapshot flag, method version and minimum group size. Prices are INR crores, density is INR/sqft. Unknown sectors/types are rejected. Express restricts endpoint names and query shapes, validates upstream response collections, and uses the shared timeout/error middleware. Successful public snapshots have `Cache-Control: public, max-age=60, must-revalidate`; failures receive no success-cache header or fabricated fallback data. Python caches bounded, deterministic results for the loaded dataset's process lifetime. Restart FastAPI after replacing the CSV.

## Sector screens

Each sector needs at least five observations to receive a score. Smaller samples appear in a separate, unranked report collection. Percentiles are recalculated against eligible sectors under the selected property type:

- Premium Luxury: 60% median asking-price percentile + 40% Luxury-share percentile.
- Growth Corridor: 50% inverse median INR/sqft percentile + 50% listing-count percentile.
- Affordable Entry: inverse lower-quartile asking-price percentile. This measures an entry-price proxy rather than the cheapest single outlier.

The highest score assigns one exclusive tier; ties prefer premium, then value, then affordability. Sorting uses descending score/count followed by sector label. Scores range up to 100 and are relative screens, not investment ratings. “Growth Corridor” is explicitly a value/volume proxy: no transport geography, appreciation, yield or future growth is established. Counts describe snapshot observations, not live availability. Report cards include median price, average density, entry-price proxy, luxury share, dominant property type and possession-age counts/shares.

## Valuation interpretation

Sector alerts provide population price variance, lower/upper quartiles, IQR relative to median and under-construction concentration. The UI calls relative IQR >= 0.75 a wide spread; this is a descriptive display threshold, not proof of mispricing. Non-under-construction age labels are **not verified ready-to-move inventory**.

Layout comparisons match sector, property type and BHK. Baselines are unfurnished, no servant room and Low-Rise; comparisons are semi/furnished, with servant room and Mid/High-Rise. Adjacent-bedroom comparisons match sector and property type. Every result includes both sample sizes, raw medians, signed difference in Cr and percent, and descriptive/limited/unavailable status. Five observations in each group are required for default display. Smaller/missing groups remain inspectable using an exploratory control. Area, condition, age, luxury and other amenities remain uncontrolled, so differences must not be presented as causal premiums or renovation returns. Negative differences remain negative; a missing group produces null, never zero.

Buyer checklists include location-specific context on construction concentration, broad price spreads and sparse selections alongside document/physical verification prompts. They do not assert legal approval, readiness or the quality of an individual home.

## Automated narrative generation

Summary text uses deterministic templates grounded in eligible sectors, with metric/value/count evidence attached to every bullet. The three screens identify the highest median price density, lowest lower-quartile price and leading value/volume score. Text changes with property type and does not invent growth trends or named-corridor conclusions. The UI discloses that no external AI model is called. A future LLM layer can verbalize this evidence contract without changing the underlying numerical claims.

## Frontend and performance

`client/src/components/Insights/InsightsDashboard.jsx` is split into its own production chunk and loaded only on first visit. Navigation paints InsightsSkeleton before deferred initialization. Analytics and Insights keep separate mounted state after first visit, preserving filters on warm navigation. Root CSS variables handle dark/light mode without a theme prop or re-fetch. Cards and tables use bounded incremental rendering; sector search and tier filters are local, while property-type changes refresh all three endpoints and location changes refresh only valuation/advisory data. Requests are aborted on selection changes/unmount; panel failures stay isolated and support retry. Native labeled controls, semantic tables, keyboard focus indicators and textual possession breakdowns provide access beyond color.

Sector actions in the brief, cards and search suggestions now open the shared `DetailModal` instead of scrolling to an inline report. A sticky modal header shows the active sector and close/ESC controls. Native dialog focus containment, backdrop dismissal, scroll locking, stable scrollbar gutters and focus cleanup on explicit dismissal are shared with Analytics. Reports, valuation comparisons and buyer checklists are tabs within one modal. Location changes remount the report and abort stale requests; switching detail tabs reuses loaded data. Valuation requests are made only when a report is opened, and closing cancels pending work.

The overview uses six cards per page with Previous/Next controls that replace the grid rather than append cards. Limited-sample sectors have their own filter; methodology is also an overlay. Modal comparison tables use eight-row pages; global sector alerts use four-card pages. Search spans up to 48rem and supports highlighted suggestions, arrow keys, Enter, Escape, clear, no-match feedback and exact dataset labels. Analytics uses the same search control to update its existing sector filter. No window-scroll or hash-navigation action remains in Insights.

## Verification and local use

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
npm.cmd --prefix server test
npm.cmd --prefix client test
npm.cmd --prefix client run build
```

Build includes ESLint with zero warnings allowed. Verification: 67 Python tests and 24 Express tests passed when the module was added; the latest frontend interaction pass has 47 passing tests. Existing dependency deprecation warnings remain in Python tests. Browser frame-rate and visual profiling were unavailable in this session and are not inferred from passing tests.

Restart FastAPI and Express to register the new routers; run/reload the Vite frontend and choose Market Insights. No additional dependencies or environment variables are needed.

Analytics map popups route directly to Insights with a sequenced, exact-sector request. Each request opens the sector report once, resets any previous property-type scope and supports reopening the same sector after a later map visit. Existing modal request cancellation, loading feedback and close-focus cleanup remain active.
