# Analytics & Market Intelligence

Analytics is the default React homepage. Price Predictor remains available from the header; Market Insights presents dataset-derived observations and the same distribution charts. Recommendations remain removed.

## Run and dependencies

From the repository root, install the requested mapping/chart packages:

```powershell
cd client
npm.cmd install leaflet react-leaflet recharts
npm.cmd run dev
```

The dependencies and exact installed versions are recorded in client/package-lock.json. On a clean checkout use `npm.cmd ci`. Restart FastAPI and Express to load their new routes:

```powershell
# Terminal 1, repository root
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

```powershell
# Terminal 2, repository root (keep the existing server/.env)
cd server
npm.cmd run dev
```

Express requires its existing MongoDB configuration. Analytics reads the CSV in Python; it does not query or mutate MongoDB. No additional Python dependency is needed.

## Data contract

The engine loads `data/processed/gurgaon_properties_post_feature_selection_v2.csv` once at startup and validates positive finite prices and areas. It does not train or modify model artifacts. The CSV is a **cross-sectional dataset snapshot**: 3,554 rows, 115 location labels. It has neither listing dates nor property coordinates.

Prices in the CSV are crores; built_up_area is square feet. Price per square foot is computed as `price * 10_000_000 / built_up_area` for each row. The KPI is the median of those per-row values, not a ratio of aggregate means.

No live inventory, completed transaction, temporal growth, return or appreciation claim is inferred from this dataset. The pipeline includes historical target-dependent outlier/area treatment, so analytics describes the processed modeling sample rather than an unbiased census of the market. Market Insights reports associations, not causation.

## Endpoints

| FastAPI GET | Express GET | Response |
| --- | --- | --- |
| /analytics/kpis | /api/analytics/kpis | Counts, mean price, median INR/sqft, top luxury sector, type averages |
| /analytics/geospatial | /api/analytics/geospatial | Resolved sector coordinates and statistics, coverage/provenance, unmapped names |
| /analytics/sector-breakdown | /api/analytics/sector-breakdown | Ranked sector volume, mean/median prices, variance and price/sqft |
| /analytics/feature-correlations | /api/analytics/feature-correlations | All filtered scatter points, Pearson r, luxury/age/floor distribution summaries |
| /analytics/floor-price-density | /api/analytics/floor-price-density | Median price and INR/sqft by floor category and property type |
| /analytics/utility-room-premium | /api/analytics/utility-room-premium | With/without-room median differences within type and BHK |
| /analytics/balcony-distribution | /api/analytics/balcony-distribution | Count, median price, density and population variance by balcony/type |
| /analytics/luxury-vs-possession | /api/analytics/luxury-vs-possession | 3 x 5 luxury/possession matrix with cohort counts |
| /health | /api/health | Live service health; Express route reports its availability separately from FastAPI |

All analytics routes accept optional `property_type=flat|house`, `luxury_category=Standard|Premium|Luxury`, and an exact `sector` label. Missing parameters mean all rows for that dimension. Sector breakdown additionally supports `sort_by=volume|median_price|avg_price` and `limit=1..115` (default volume, 20). The dashboard requests the 15 highest median-price sectors; API consumers can independently request the top 20 by volume.

Example:

```text
http://localhost:5000/api/analytics/sector-breakdown?property_type=flat&luxury_category=Luxury&sort_by=median_price&limit=15
```

Every response includes meta.source_sha256, original/filtered row counts, filters, units and snapshot/time-series flags. Aggregations are cached in memory for repeated filter combinations and refreshed by restarting FastAPI after a dataset change. Cache keys include all filters and ranking options. Dataset/predictor failures cause startup to fail; a missing coordinate lookup leaves charts working and returns unmapped locations rather than invented points.

## Statistical definitions

- Total Listings = filtered dataset row count. It is not a count of currently available unique live listings.
- Average Price = arithmetic mean of filtered crore prices.
- Median Price/sqft = median per-row INR price / built-up sqft.
- Top Luxury Sector = sector with the most rows labelled Luxury, after filters. Alphabetical tie-break; null if no Luxury-tier observations match. This is not the sector with the highest average price.
- Price variance = population variance (`ddof=0`) of sector prices, in squared crores; a one-row group has variance 0.
- Scatter = all filtered price/area observations, color-grouped by furnishing or property type, with global Flats/Houses toggles. No synthetic points or undisclosed sampling.
- Distributions = median bars split by property type; detail tables include count, median and 25th/75th percentiles. Missing groups remain absent/null, not zero-valued bars.
- Pearson r = observed linear correlation of raw area and raw price; null for fewer than two varying values. It is not a model accuracy measure.
- Empty filter combination = count 0, undefined numerical KPIs null and empty arrays. UI shows an empty state, not a fabricated zero market price.

## Map data and attribution

The processed dataset has no coordinates. `data/reference/sector_coordinates.json` is a separate lookup of approximate polygon centroids derived from `gurugram_sectors_source.geojson`, a public GMDA-derived sector boundary snapshot from [XAE-A-Xii/expressway](https://github.com/XAE-A-Xii/expressway). That repository attributes its boundaries to GMDA/DTCP. Its upstream GMDA service currently requires a token, so direct official validation was unavailable. This app does not claim that the derived centroids are official survey points.

All 115 dataset labels now have display positions. Resolution is explicit in every response: 102 sector polygon references, 3 normalized sector aliases, 2 parent-sector references (17A/B -> Sector 17), 6 named locality/road references from OpenStreetMap, 1 normalized road alias and 1 city-level fallback for the ambiguous label `new`.

This is 100% **display coverage**, not 100% precise geocoding. `new` has no recoverable unique place name; its dashed city-level marker is explicitly described as unresolved. Phase labels use their parent sector and Sohna Road variants share a road reference. No normalized labels are merged in statistics: all 115 original labels keep separate counts/medians. Co-located icons spread in screen pixels without changing lat/lng, making shared references selectable.

Additional named references are stored in data/reference/sector_fallback_geocodes.json, with source URLs, lookup URLs, retrieval timestamp and OSM attribution (ODbL). Geocoder matches are reviewed: Sector 17A/B searches incorrectly returned Sector 62 and were rejected; Sector 9 initially returned Manesar and was replaced by the verified Gurgaon place node 2733423637. These are approximate locality/road references, not property coordinates. Response fields resolution_counts, approximate_sectors, unresolved_location_labels and display_coverage_percent expose those distinctions.

The lookup retains source URL, provenance URL, source SHA-256 and retrieval timestamp. The committed source snapshot enables offline reproduction:

```powershell
.\.venv\Scripts\python.exe scripts/refresh_sector_coordinates.py --source data/reference/gurugram_sectors_source.geojson
```

Omitting --source downloads the public GeoJSON with normal TLS verification. Approximate sector-scale planar polygon centroids account for interior rings. They locate sectors, not listings. The generator validates bounds and refuses an empty match set.

The basemap uses standard OpenStreetMap tiles with visible contributor attribution. Sector geometry attribution is separately linked. Tile requests go directly from the browser to tile.openstreetmap.org; no provider secret is needed. If tiles fail, the UI reports the error and keeps sector overlays/directories available. Follow the provider's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) when scaling traffic. Custom price markers are emerald below 2 Cr, muted emerald from 2 to under 5 Cr, and amber at 5 Cr or more. Marker labels/tooltips preserve the returned dataset median to up to four decimal places; the popup includes counts and price variance.

## UI and operational behavior

The sticky filter bar applies the same selection to KPIs, map and all charts. The sector directory selects the shared Analytics filter. Map popups instead offer View Sector Insights, switching to the dedicated Insights tab and opening the exact sector report. Filters abort stale requests; failures are isolated per panel and offer retry without replacing successful responses with placeholders. Charts/maps reserve 420px canvases and are lazy-loaded away from the initial predictor bundle. KPI and feature summaries use stable responsive four-column grids. View Detail opens one full-width native dialog outside the grid; detailed charts and tables never stretch individual summary cards. Theme colors use root CSS variables without re-fetching analytics or recalculating chart data.

Utility Room Price Comparison describes asking-price associations rather than added value. Its default chart requires at least five listings in each with/without-room group; this is a display safeguard, not a significance test. Smaller comparisons remain in the raw median/count table with an insufficient-evidence label and can be included using an exploratory checkbox. Missing comparison groups never become zero bars. Negative observations are retained, and the UI explains that sector, area, condition and luxury mix are uncontrolled. BHK labels explicitly denote bedroom counts. This presentation change does not alter the source dataset, API calculations or prediction model.

The header performs an uncached GET /api/health every 30 seconds and on manual refresh. A healthy Express with an unavailable FastAPI is distinguished from an unreachable Express. This is periodic health reporting, not a persistent push connection. The existing cached schema route is used only for dropdown options.

## Verification

Run `.venv/Scripts/python -m pytest tests -q`, `npm.cmd --prefix server test`, `npm.cmd --prefix client test`, and `npm.cmd --prefix client run build`. Tests compare aggregates to pandas calculations from the actual CSV; cover all six type/tier combinations, invalid/empty filters, coordinate coverage/provenance, ranking, population variance, proxy failures, default navigation, chart filter propagation and predictor regression.

Implementation verification: 58 Python tests, 21 Express tests and 21 React tests passed (100 total); the Vite production build passed. Live checks on temporary local ports returned 200 for all four Express analytics routes and health, 939 filtered Luxury-flat observations, 750 house scatter observations and 115 display markers, including one disclosed city fallback. The existing saved-example prediction still returned INR 7,778,479.76. The five tuned_v1 artifact hashes and processed CSV hash remain unchanged. Browser visual verification was unavailable in the implementation session; inspect the dashboard at the Vite Local URL.

## Detailed Feature Intelligence

The four new endpoints accept the same property_type, luxury_category and sector filters as the existing panels. They perform no fitting, model inference or mutation of tuned_v1.

- Floor price/density returns all three floor categories segmented by property type. Each group includes count, median/mean price in crores, median INR per built-up sqft and price variance in squared crores. Empty groups have count zero and null statistics.
- Utility-room comparisons are stratified by property type and bedroom count. For each servant room/store room flag, the response includes with_room and without_room summaries, observed_price_difference_cr (median with minus median without), observed_difference_percent, observed_density_difference_inr, comparison_available and small_sample. Differences are computed before output rounding. At least one observation is required in both groups; otherwise differences are null. Either group below five observations is flagged. Negative differences remain negative.
- Utility differences are descriptive associations, not an exact causal value added. They do not control for sector, built-up area, age or luxury beyond the chosen global filters. UI labels, footnotes, tables and missing-cohort behavior preserve this distinction.
- Balcony distribution keeps 0, 1, 2, 3 and 3+ distinct and is segmented by property type. UI metrics can switch between median price, median price/sqft, population price variance and count.
- The luxury-possession response includes all 15 cells across three luxury tiers and five possession stages. Every cell includes n and median density/price; empty cells remain null. The UI heatmap shows price and count with accessible cell descriptions.

The Detailed Feature Intelligence section is below the map. It includes interactive metric and BHK/room selectors, exact-statistics tables and small-sample/missing-cohort notes. The previous duplicate floor distribution chart was replaced by the richer floor-density panel.

Final checks: all four new endpoints returned HTTP 200 through an actual Express/Axios-to-FastAPI path for Luxury flats (939 matching rows); map aggregation returned 115 display markers and 3,554 mapped observations. All five protected bundle files and the source CSV matched their earlier SHA-256 checksums. Core model files were not retrained or edited. Existing Python third-party deprecation warnings remain unrelated to the analytical changes.

The map starts at Gurgaon [28.4595, 77.0266], zoom 11. Reset View appears after marker interactions or panning/zooming. Reset closes popups/bound tooltips and clears hover/selection before restoring the default viewport; it respects reduced motion and does not remount the map or change dataset filters. Leaflet DOM propagation guards keep reset clicks from initiating map dragging/zooming.
