import { lazy, memo, Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowDownWideNarrow, Building2, CircleAlert, Crown, IndianRupee, Layers, MapPin, RefreshCw, SlidersHorizontal, Compass } from 'lucide-react';
import { request } from '../../api';
import AnalyticsSkeleton, { VisualSkeleton } from './AnalyticsSkeleton';
import SectorSearch from '../SectorSearch';
import DeferredPanel from './DeferredPanel';
import { CardDetailsProvider, CardDetailButton, KpiDetails } from './CardDetails';
const AreaScatter = lazy(() => import('./RelationshipCharts').then((module) => ({ default: module.AreaScatter })));
const SectorChart = lazy(() => import('./RelationshipCharts').then((module) => ({ default: module.SectorChart })));
const DistributionChart = lazy(() => import('./RelationshipCharts').then((module) => ({ default: module.DistributionChart })));
const FeatureIntelligence = lazy(() => import('./FeatureIntelligence'));
const GeoMap = lazy(() => import('./GeoMap'));
const ENDPOINTS = { kpis: 'kpis', geo: 'geospatial', sectors: 'sector-breakdown', features: 'feature-correlations',
  floor: 'floor-price-density', utility: 'utility-room-premium', balcony: 'balcony-distribution', positioning: 'luxury-vs-possession' };
const count = (v) => Number(v).toLocaleString('en-IN');

function AnalyticsDashboardView({ schema, notify, onConnection, onOpenSectorInsights, insights = false }) {
  const [locationSearch, setLocationSearch] = useState('');
  const [filters, setFilters] = useState({ property_type: '', luxury_category: '', sector: '' });
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setData({}); setErrors({});
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    Promise.allSettled(Object.entries(ENDPOINTS).map(async ([key, endpoint]) => {
      const query = new URLSearchParams(params);
      if (key === 'sectors') { query.set('sort_by', 'median_price'); query.set('limit', '15'); }
      const result = await request(`/api/analytics/${endpoint}${query.size ? `?${query}` : ''}`, { signal: controller.signal });
      const array = { geo: 'sectors', sectors: 'sectors', features: 'price_vs_area', floor: 'groups', utility: 'groups', balcony: 'groups', positioning: 'cells' }[key];
      if (!result.meta || (array && !Array.isArray(result[array]))) throw new Error('Analytics response is incomplete.');
      return [key, result];
    })).then((responses) => {
      if (controller.signal.aborted) return;
      const success = {}, failed = {};
      responses.forEach((result, index) => {
        if (result.status === 'fulfilled') success[result.value[0]] = result.value[1];
        else failed[Object.keys(ENDPOINTS)[index]] = result.reason;
      });
      setData(success); setErrors(failed); setLoading(false);
      if (Object.keys(failed).length) { const error = Object.values(failed)[0]; notify(error.message); onConnection(error); }
      else onConnection();
    });
    return () => controller.abort();
  }, [filters, revision, notify, onConnection]);
  const set = useCallback((key, value) => setFilters((previous) => previous[key] === value ? previous : ({ ...previous, [key]: value })), []);
  const selectSector = useCallback((value) => set('sector', value), [set]);
  const selectPropertyType = useCallback((value) => set('property_type', value), [set]);
  const kpi = data.kpis;
  const noResults = kpi?.total_listings === 0;
  const reset = () => setFilters({ property_type: '', luxury_category: '', sector: '' });
  const errorPanel = useCallback((key) => <div className="analytics-panel-error" role="status"><CircleAlert size={20}/><p>{errors[key]?.message || 'This panel is unavailable.'}</p><button onClick={() => setRevision((v) => v + 1)}>Retry data</button></div>, [errors]);
  const metrics = [
    { label: 'Dataset listings', value: kpi ? count(kpi.total_listings) : '—', note: kpi ? `Across ${kpi.sector_count} sectors` : 'Listing observations', icon: Building2 },
    { label: 'Average listing price', value: kpi?.avg_price_cr != null ? `₹${kpi.avg_price_cr.toFixed(2)} Cr` : '—', note: 'Arithmetic mean · selected properties', icon: IndianRupee },
    { label: 'Median price / sq ft', value: kpi?.median_price_per_sqft_inr != null ? `₹${count(Math.round(kpi.median_price_per_sqft_inr))}` : '—', note: 'Price divided by built-up area', icon: Layers },
    { label: 'Top luxury sector', value: kpi?.top_luxury_sector?.sector || '—', note: kpi?.top_luxury_sector ? `${kpi.top_luxury_sector.listing_count} Luxury-tier listings · by volume` : 'No Luxury-tier listings in this selection', icon: Crown },
  ];
  return <div className="analytics-workspace">
    <div className="analytics-filter-bar"><div className="filter-label"><SlidersHorizontal size={17}/><span>Refine the market</span></div><label>Property type<select aria-label="Analytics property type" value={filters.property_type} onChange={(e) => set('property_type', e.target.value)}><option value="">All property types</option><option value="flat">Flats</option><option value="house">Houses</option></select></label><label>Luxury tier<select aria-label="Analytics luxury tier" value={filters.luxury_category} onChange={(e) => set('luxury_category', e.target.value)}><option value="">All lifestyle tiers</option>{(schema?.categories.luxury_category || ['Standard', 'Premium', 'Luxury']).map((v) => <option key={v}>{v}</option>)}</select></label><label>Location<select aria-label="Analytics sector" value={filters.sector} onChange={(e) => set('sector', e.target.value)}><option value="">All Gurgaon sectors</option>{schema?.categories.sector.map((v) => <option key={v}>{v}</option>)}</select></label><button className="filter-reset" onClick={reset}>Reset filters</button><button className="icon-button" aria-label="Refresh analytics" onClick={() => setRevision((v) => v + 1)}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button></div>
    <SectorSearch label="Search analytics locations" options={schema?.categories.sector || []} value={locationSearch} onChange={setLocationSearch} onSelect={(name) => { setLocationSearch(name); selectSector(name); }}/>
    <div className="analytics-section-intro"><div><span className="eyebrow">{insights ? 'EVIDENCE, IN CONTEXT' : 'THE GURGAON MARKET, AT A GLANCE'}</span><h2>{insights ? 'The story behind the numbers' : 'A market worth understanding.'}</h2></div><span className="snapshot-pill"><span/> Processed dataset snapshot</span></div>
    {loading ? null : <div className="kpi-grid grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">{metrics.map(({ label, value, note, icon: Icon }) => <article className="kpi-card" key={label}><div><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><p>{note}</p>{kpi && <CardDetailButton cardId={`kpi-${label}`} title={label}><KpiDetails metric={label} kpi={kpi}/></CardDetailButton>}</article>)}</div>}
    {errors.kpis && errorPanel('kpis')}
    {loading ? <AnalyticsSkeleton showFilters={false}/> : noResults ? <div className="analytics-empty"><Building2 size={30}/><h3>No properties match this selection</h3><p>Try another property type or luxury tier.</p><button onClick={reset}>Reset filters</button></div> : <>
      {insights && kpi && <div className="insight-grid"><article className="market-insight"><Compass size={23}/><h3>A measured view of the market</h3><p>This selection contains {count(kpi.total_listings)} observations. The average asking price is {kpi.avg_price_cr == null ? 'unavailable' : `₹${kpi.avg_price_cr.toFixed(2)} Cr`}. These are historical listing observations, not completed transactions.</p></article><article className="market-insight"><ArrowDownWideNarrow size={23}/><h3>Compare like with like</h3><p>Area and price show a Pearson correlation of {data.features?.price_area_pearson_r?.toFixed(2) ?? '—'} in this selection. Property mix, location and amenities can influence both; this is an association, not a causal effect.</p></article><article className="market-insight"><Crown size={23}/><h3>Look beyond the headline</h3><p>{kpi.top_luxury_sector ? `${kpi.top_luxury_sector.sector} has the most Luxury-tier observations in this selection (${kpi.top_luxury_sector.listing_count}).` : 'No Luxury-tier observations match the selected filters.'} Sector samples vary in size; inspect their counts before comparing.</p></article></div>}
      {<div className="map-overview-grid" data-visible={!insights} aria-hidden={insights} inert={insights}><section className="analytics-card map-panel"><div className="chart-heading"><div><span className="eyebrow">LOCATION IS EVERYTHING</span><h2>One city. Many micro-markets.</h2><p>Explore sector prices, volumes and the spaces between.</p></div><span className="small-pill"><MapPin size={12}/> Gurgaon</span></div>{data.geo ? <Suspense fallback={<VisualSkeleton kind="map" label="Loading Gurgaon map"/>}><GeoMap data={data.geo} onOpenSectorInsights={onOpenSectorInsights}/></Suspense> : errorPanel('geo')}</section><aside className="property-mix-panel"><header><span className="eyebrow">PROPERTY MIX</span><Building2 size={22}/></header><h2>The market, in balance.</h2><dl className="compact-property-grid"><div><dt>Total properties</dt><dd>{kpi ? count(kpi.total_listings) : 'Not available'}</dd></div><div><dt>Median price / sq ft</dt><dd>{kpi?.median_price_per_sqft_inr != null ? `₹${count(Math.round(kpi.median_price_per_sqft_inr))}` : 'Not available'}</dd></div><div><dt>Locations</dt><dd>{kpi?.sector_count ?? 'Not available'}</dd></div><div><dt>Top luxury sector</dt><dd>{kpi?.top_luxury_sector?.sector || 'Not available'}</dd></div></dl><div className="property-type-rows">{kpi?.avg_price_by_property_type.map((row) => <div key={row.property_type}><span>{row.property_type === 'flat' ? 'Apartments / flats' : 'Independent houses'}<small>{count(row.listing_count)} properties</small></span><strong>₹{row.avg_price_cr.toFixed(2)} Cr<small>average price</small></strong></div>)}</div><p>Historical listing snapshot ? selected filters</p></aside></div>}
      <DeferredPanel kind="features" label="Loading feature intelligence"><FeatureIntelligence data={data} errorPanel={errorPanel}/></DeferredPanel>
      <section aria-label="Market relationship reports"><div className="analytics-section-intro"><div><span className="eyebrow">EXPLORE ONE QUESTION AT A TIME</span><h2>Market relationships</h2></div></div>
        <div className="compact-sector-grid insights-sector-grid">
          {data.features && <article className="analytics-card feature-summary-card compact-sector-card"><span className="eyebrow">SPACE & VALUE</span><h3>How much does space matter?</h3><p>Inspect area, price and furnishing patterns in one focused chart.</p><CardDetailButton cardId="area-scatter" title="Price vs Built-up Area">{(close) => <AreaScatter data={data.features} propertyType={filters.property_type} detail onPropertyType={(value) => { close(); selectPropertyType(value); }}/>}</CardDetailButton></article>}
          {data.sectors && <article className="analytics-card feature-summary-card compact-sector-card"><span className="eyebrow">LOCATION PREMIUM</span><h3>The sector price spectrum</h3><p>Compare 15 sector medians and inspect their sample sizes.</p><CardDetailButton cardId="sector-comparison" title="Sector Price Comparison">{(close) => <SectorChart data={data.sectors} detail onSelectSector={(value) => { close(); selectSector(value); }}/>}</CardDetailButton></article>}
          {data.features && [['The lifestyle premium', 'Luxury-tier medians', data.features.luxury_distribution], ['Age, through a price lens', 'Possession-age medians', data.features.age_distribution]].map(([title, subtitle, rows]) => <article className="analytics-card feature-summary-card compact-sector-card" key={title}><span className="eyebrow">PROPERTY COMPOSITION</span><h3>{title}</h3><p>Compare groups with counts and distribution statistics.</p><CardDetailButton cardId={`distribution-${title}`} title={title}><DistributionChart title={title} subtitle={subtitle} rows={rows} detail/></CardDetailButton></article>)}
          {errors.features && errorPanel('features')}{errors.sectors && errorPanel('sectors')}
        </div>
      </section>
    </>}
    <div className="analytics-provenance"><span><Layers size={14}/> Source: processed Gurgaon listings · {kpi?.meta ? count(kpi.meta.dataset_rows) : '—'} total records</span><span>Prices: INR crores · Areas: sq ft · Snapshot, not live inventory</span></div>
  </div>;
}

const MemoDashboardView = memo(AnalyticsDashboardView);
export default memo(function AnalyticsDashboard(props) {
  return <CardDetailsProvider><MemoDashboardView {...props}/></CardDetailsProvider>;
});
