# Analytics navigation and theme performance

## Changes

- AnalyticsSkeleton provides the same KPI/map/chart structure for route, data and chunk loading. Navigation updates the selected tab immediately; optional visual work is queued after two animation frames, giving the skeleton a paint opportunity first.
- AnalyticsDashboard is lazy-loaded separately from RelationshipCharts, FeatureIntelligence, FeatureCharts, the shared Recharts code and GeoMap/Leaflet CSS. The production build emits a roughly 17.5 KB dashboard JS chunk and a 3.4 KB feature-summary chunk. FeatureCharts and relationship charts load only when a summary is inspected. These are uncompressed build sizes, not measured latency improvements.
- DeferredPanel uses IntersectionObserver with a 160px margin. A near-viewport panel schedules initialization after a paint and, where available, during browser idle time with a bounded timeout. Unsupported observer/idle APIs have timer fallbacks. Pending callbacks and observers are cancelled on unmount.
- Map and chart canvases reserve 420px height at all breakpoints. Map slots reserve metadata space; chart slots and matching skeletons reserve the card body. Deferred work still runs on the main thread; scheduling provides a paint opportunity rather than moving DOM/SVG work to a worker.
- KPI and feature-summary grids use one column on mobile, two from 768px and four from 1024px, with 24px gaps. A single card-ID selection opens a native dialog portaled outside the grid, up to 56rem wide. Charts and statistical tables use the modal width without expanding sibling cards. The selected trigger shows an amber badge and emerald border; Escape, backdrop and close-button dismissal clear focus on explicit dismissal and restore body scrolling.
- The Analytics dashboard is retained after its first visit. Switching to Price Predictor or the dedicated Insights dashboard does not unmount its filters, fetched datasets, charts or map. Insights also retains its own mounted state after first visit. Inactive panes are inert, aria-hidden, clipped and invisible while retaining measured child widths; display:none would cause responsive charts to resize to zero and back.
- The map is retained when switching to Insights, with a stable viewport width. Leaflet sizing work runs after the container has painted. The initial and reset viewport is Gurgaon center at zoom 11; data changes do not override the viewport with automatic bounds fitting. Insights has a separate lazy bundle and immediate skeleton, and loads no map/chart code of its own.
- React.memo protects dashboard, predictor, map and chart boundaries. Callback references are stable. Scatter buckets are computed in one memoized pass instead of repeated filters; utility/floor/balcony pivots, BHK options, distribution rows and matrix lookup maps are memoized by their actual source data and controls.
- ThemeToggle owns its own small React state. It sets data-theme on the document root directly; App and its visual descendants receive no theme props. Root CSS variables recolor chart SVG fills, axes, grids, cards, tooltips and matrix cells. CSS adjusts tile presentation without requesting a different basemap or recreating Leaflet.
- Recharts animations are disabled for data series, avoiding replaying visual animations during control changes. Unchanged schema responses retain their previous object identity.

The implementation follows [React memo guidance](https://react.dev/reference/react/memo), [useMemo](https://react.dev/reference/react/useMemo), [lazy](https://react.dev/reference/react/lazy), and [Leaflet sizing guidance](https://leafletjs.com/reference#map-invalidatesize). Memoization applies to actual transformations and stable props; it does not merely wrap a data reference in a redundant calculation.

## Verification

47 frontend tests pass, including:

- Immediate skeleton feedback before deferred tab initialization.
- Theme changes without dashboard re-renders or additional requests.
- Dashboard control state preserved across predictor visits.
- Analytics datasets and map DOM retained while navigating to other tabs.
- Rapid navigation cancelling obsolete visual work.
- Viewport gating and cancellation of deferred mounts.
- Existing predictor, feature-intelligence and marker checks.
- Portal placement, unchanged grid children, exclusive card selection, lazy detail charts, focus cleanup, scroll unlocking and Escape/backdrop dismissal.

`npm.cmd --prefix client run build` passes and produces independent map, chart, intelligence and dashboard chunks. Its prebuild hook runs ESLint with zero warnings allowed, including React Hook dependency checks. `npm.cmd --prefix client run lint` also runs it separately. No model, dataset, FastAPI or Express behavior was changed in this performance refactor.

## Browser profiling still required

There was no enabled browser surface in the implementation session. No 60 FPS, INP or CLS measurement is claimed from unit tests or build output. Cold mounting the full scatter plot still creates SVG nodes for every observation; device speed and dataset size affect that initial commit even though it is deferred and memoized thereafter.

To measure on the target browser/device:

1. Run `npm.cmd --prefix client run build` and `npm.cmd --prefix client run preview`, with FastAPI/Express running. Profile the production preview, not development StrictMode.
2. Record a Chrome/Edge Performance trace for Analytics -> Predictor -> Insights -> Analytics, rapid repeated switches, and light/dark toggling. Repeat once cold and once warm, at desktop and mobile widths.
3. Inspect frames, long tasks, layout shifts and interaction latency. A 60 Hz display provides about 16.7ms per frame; verify on the intended hardware rather than inferring a guarantee from the scheduling strategy.
4. In React Profiler, confirm the chart and map components do not commit for a theme-only change. In Network, confirm warm tab visits do not repeat the eight analytics requests or reload visualization chunks. Explicit refreshes and filter changes should still fetch new selections.
5. Scroll to deferred panels and inspect map tooltips, chart controls and detail tables. Check that inactive panes cannot receive keyboard focus and that map/chart dimensions remain stable after a warm return.

## Compact overview and shared details

Insights now renders six report cards per page rather than accumulating more cards. Sector reports, buyer checklists, valuation tables and scoring explanations live in the shared DetailModal (56rem maximum width, 85dvh maximum height). SectorDetails is a separate lazy chunk; valuation requests begin only when a report opens. Modal tables and global alert lists are paginated, preventing unbounded DOM growth. Analytics keeps its map visible but replaces the four lower relationship charts with compact modal triggers; chart chunks mount only on inspection. Both modules share a wide, keyboard-accessible sector search with highlighted suggestions. No backend endpoints, model artifacts or prediction behavior changed in this UI pass.

Map navigation uses a floating reset control after a marker interaction or viewport move. It stops previous animations, closes bound overlays, clears marker highlight state and flies to [28.4595, 77.0266] at zoom 11 (no animation for reduced motion). Popup actions now navigate to Market Insights with an exact sector label and a sequence token. Insights consumes each token once, clears old property-type scope and opens the sector report; repeat visits to the same sector create a fresh token. No Analytics dataset filter is changed by this navigation.
