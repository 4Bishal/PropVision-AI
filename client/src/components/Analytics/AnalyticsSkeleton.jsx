import { memo } from 'react';

export const VisualSkeleton = memo(function VisualSkeleton({ kind = 'chart', label = 'Loading visualization' }) {
  if (kind === 'features') return <section className="feature-intelligence" role="status" aria-label={label}>
    <div className="skeleton-heading"><i/><b/></div>
    <div className="intelligence-grid">{[0, 1, 2, 3].map((id) => <div className="analytics-card feature-summary-card summary-skeleton" key={id} aria-hidden="true"><i/><b/><i/><i/></div>)}</div>
  </section>;
  return <div className={`visual-skeleton ${kind === 'map' ? 'map-skeleton' : 'analytics-card chart-skeleton'}`} role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    {kind !== 'map' && <div className="skeleton-heading" aria-hidden="true"><i/><b/><i/></div>}
    <div className="skeleton-plot" aria-hidden="true">{kind === 'map' ? <><div className="skeleton-map-road"/><i className="skeleton-map-pin"/></> : <div className="skeleton-bars">{[35, 65, 45, 80, 55, 72].map((height, i) => <i key={i} style={{ height: `${height}%` }}/>)}</div>}</div>
    <div className="skeleton-caption" aria-hidden="true"/>
  </div>;
});

export default memo(function AnalyticsSkeleton({ showFilters = true }) {
  return <div className="analytics-skeleton" role="status" aria-label="Loading analytics workspace" aria-busy="true">
    <span className="sr-only">Loading market intelligence</span>
    {showFilters && <div className="skeleton-filter" aria-hidden="true"><i/><i/><i/></div>}
    <div className="kpi-grid" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div className="kpi-card skeleton-kpi" key={i}><span/><strong/><span/></div>)}</div>
    <div className="map-overview-grid"><VisualSkeleton kind="map" label="Loading market map"/><div className="skeleton-market-panel" aria-hidden="true"><i/><b/><i/></div></div>
    <VisualSkeleton kind="features" label="Loading market report cards"/>
  </div>;
});
