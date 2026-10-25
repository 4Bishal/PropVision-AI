import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, CircleAlert, Compass, RefreshCw } from 'lucide-react';
import { request } from '../../api';
import DetailModal from '../DetailModal';
import SectorSearch from '../SectorSearch';
import InsightsSkeleton from './InsightsSkeleton';
import { TIERS, cr, inr } from './insightFormat';

const SectorDetails = lazy(() => import('./SectorDetails'));
const PAGE_SIZE = 6;
const TITLES = { report: 'Sector Details', valuation: 'Valuation Alert', advisory: 'Buyer Advisory', methodology: 'How market tiers work' };

function ErrorPanel({ error, retry }) {
  return <div className="insights-error" role="alert"><CircleAlert size={20}/><p>{error.message}</p><button type="button" onClick={retry}>Retry insights</button></div>;
}

const SectorCard = memo(function SectorCard({ row, selected, onOpen }) {
  return <article data-testid="sector-tier-card" className={`insights-card sector-report compact-sector-card ${selected ? 'is-selected' : ''}`}>
    <div className="sector-report-top"><span className="insights-badge">{TIERS[row.tier] || 'Limited sample'}</span><Compass size={19}/></div>
    <h3><button type="button" className="sector-title-action" onClick={(e) => onOpen(row.sector, 'report', e.currentTarget)}>{row.sector}</button></h3>
    <p>{row.listing_count} snapshot listings · {row.dominant_property_type === 'flat' ? 'Flats' : 'Houses'} dominate</p>
    <dl className="sector-metrics"><div><dt>Median asking price</dt><dd>{cr(row.median_price_cr)}</dd></div><div><dt>Average / sq ft</dt><dd>{inr(row.avg_price_per_sqft_inr)}</dd></div></dl>
    <div className="sector-mini-facts"><span>Luxury share <strong>{row.luxury_share_percent}%</strong></span><span>{row.tier === 'value' ? 'Value proxy · growth unverified' : row.tier ? 'Snapshot market screen' : 'Insufficient evidence to rank'}</span></div>
    <div className="insights-card-actions"><button type="button" className="insights-sector-action insights-inspect" aria-haspopup="dialog" aria-pressed={selected} onClick={(e) => onOpen(row.sector, 'report', e.currentTarget)}>View Sector Details <span className="sr-only">for {row.sector}</span><ArrowUpRight size={15}/></button>
      <div className="sector-secondary-actions"><button type="button" aria-label={`Valuation Alert for ${row.sector}`} aria-haspopup="dialog" onClick={(e) => onOpen(row.sector, 'valuation', e.currentTarget)}>Valuation Alert<span className="sr-only"> for {row.sector}</span></button><button type="button" aria-label={`Buyer Advisory for ${row.sector}`} aria-haspopup="dialog" onClick={(e) => onOpen(row.sector, 'advisory', e.currentTarget)}>Buyer Advisory<span className="sr-only"> for {row.sector}</span></button></div>
    </div>
  </article>;
});

export default memo(function InsightsDashboard({ notify, onConnection, sectorRequest }) {
  const [propertyType, setPropertyType] = useState('');
  const [sector, setSector] = useState('');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [overview, setOverview] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const handledRequest = useRef(null);
  useEffect(() => {
    if (!sectorRequest || handledRequest.current === sectorRequest.id) return;
    handledRequest.current = sectorRequest.id;
    // Map navigation starts with all property types so a previous house/flat
    // filter cannot conceal the selected sector's report.
    setPropertyType(''); setSector(sectorRequest.sector);
    setModal({ view: 'report', trigger: sectorRequest.trigger });
  }, [sectorRequest]);
  const openSector = useCallback((name, view = 'report', trigger = document.activeElement) => {
    setSector(name); setModal({ view, trigger });
  }, []);
  const selectTier = (value) => { setTier(value); setPage(0); };
  const close = useCallback(() => setModal(null), []);
  const retry = () => setRevision((v) => v + 1);

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setOverview({}); setErrors({});
    const params = new URLSearchParams(propertyType ? { property_type: propertyType } : {});
    const endpoints = ['sector-rankings', 'summary-narratives'];
    Promise.allSettled(endpoints.map(async (endpoint) => {
      const result = await request(`/api/insights/${endpoint}${params.size ? `?${params}` : ''}`, { signal: controller.signal });
      const collection = endpoint === 'sector-rankings' ? 'sectors' : 'bullets';
      if (!result.meta || !Array.isArray(result[collection])
          || (collection === 'sectors' && !Array.isArray(result.limited_sample_sectors))
          || (collection === 'bullets' && !Array.isArray(result.takeaways))) throw new Error('Insights response is incomplete.');
      return result;
    })).then((results) => {
      if (controller.signal.aborted) return;
      const next = {}, failed = {};
      results.forEach((result, index) => { if (result.status === 'fulfilled') next[endpoints[index]] = result.value; else failed[endpoints[index]] = result.reason; });
      setOverview(next); setErrors(failed); setLoading(false);
      const error = Object.values(failed)[0];
      if (error) { notify(error.message); onConnection(error); } else onConnection();
    });
    return () => controller.abort();
  }, [propertyType, revision, notify, onConnection]);

  const rankings = overview['sector-rankings'];
  const narratives = overview['summary-narratives'];
  const allSectors = useMemo(() => [...(rankings?.sectors || []), ...(rankings?.limited_sample_sectors || [])], [rankings]);
  const sectorNames = useMemo(() => allSectors.map((r) => r.sector).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [allSectors]);
  const cards = useMemo(() => (tier === 'limited' ? rankings?.limited_sample_sectors || [] : rankings?.sectors || []).filter((r) => (tier === 'limited' || !tier || r.tier === tier) && r.sector.toLowerCase().includes(search.toLowerCase().trim())), [rankings, tier, search]);
  const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const row = allSectors.find((item) => item.sector === sector);

  return <div className="insights-workspace compact-insights">
    <div className="analytics-filter-bar insights-filter-bar"><span className="filter-label"><Compass size={17}/> Market intelligence</span><label>Property type<select aria-label="Insights property type" value={propertyType} onChange={(e) => { setPropertyType(e.target.value); setSector(''); setPage(0); }}><option value="">All property types</option><option value="flat">Flats</option><option value="house">Houses</option></select></label><span className="snapshot-pill">Dataset snapshot · no growth forecast</span><button type="button" className="icon-button" aria-label="Refresh insights" onClick={retry}><RefreshCw size={17} className={loading ? 'animate-spin' : ''}/></button></div>
    {loading ? <InsightsSkeleton/> : <>
      {errors['summary-narratives'] ? <ErrorPanel error={errors['summary-narratives']} retry={retry}/> : narratives && <section className="executive-brief compact-brief" aria-labelledby="brief-title"><div className="brief-heading"><span className="eyebrow"><Compass size={15}/> YOUR MARKET IN THREE TAKEAWAYS</span><span className="brief-generation">Data-grounded summaries</span></div><h2 id="brief-title">{narratives.title}</h2><ul className="brief-bullets">{narratives.bullets.map((bullet) => <li key={bullet.id}><span className="brief-badge">{bullet.badge}</span><p>{bullet.text}</p><div className="insights-card-actions"><button type="button" className="insights-sector-action" aria-haspopup="dialog" onClick={(e) => openSector(bullet.sector, 'report', e.currentTarget)}>Explore {bullet.sector} <ArrowUpRight size={14}/></button></div></li>)}</ul>{!narratives.bullets.length && <p>No sectors meet the sample requirement.</p>}<p className="brief-disclosure"><CheckCircle2 size={15}/> Asking prices, not completed transactions. Growth and future returns are unverified.</p><small>{narratives.generation}</small></section>}
      <section aria-labelledby="tier-title"><div className="analytics-section-intro"><div><span className="eyebrow">SECTOR REPORT CARDS</span><h2 id="tier-title">Find your market position</h2></div><button type="button" className="insights-sector-action" onClick={(e) => setModal({ view: 'methodology', trigger: e.currentTarget })}>How tiers work</button></div>
        <SectorSearch options={sectorNames} value={search} onChange={(value) => { setSearch(value); setPage(0); }} onSelect={(name, trigger) => openSector(name, 'report', trigger)}/>
        <div className="insights-tier-actions" role="group" aria-label="Sector market tiers">{[['', 'All market tiers'], ...Object.entries(TIERS), ['limited', 'Limited samples']].map(([value, label]) => <button type="button" key={value} className="insights-sector-action" aria-pressed={tier === value} onClick={() => selectTier(value)}>{label}</button>)}</div>
        {errors['sector-rankings'] ? <ErrorPanel error={errors['sector-rankings']} retry={retry}/> : <>
          <p className="insights-result-count" role="status">{cards.length} sector reports · page {currentPage + 1} of {pages}</p>
          <div className="insights-sector-grid compact-sector-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">{cards.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE).map((item) => <SectorCard key={item.sector} row={item} selected={sector === item.sector} onOpen={openSector}/>)}</div>
          {!cards.length && <p className="insights-empty">No sector reports match these filters.</p>}
          {pages > 1 && <div className="compact-pagination"><button type="button" disabled={!currentPage} onClick={() => setPage((p) => p - 1)}>Previous sectors</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={currentPage + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next sectors</button></div>}
        </>}
      </section>
      <section className="insights-quick-tools insights-sector-grid" aria-label="Market detail tools">{[['valuation', 'Valuation Alert', 'Compare price spreads and layout differences.'], ['advisory', 'Buyer Advisory', 'A short checklist for your next property visit.']].map(([view, title, note]) => <article className="insights-card" key={view}><span className="insights-badge">ON DEMAND</span><h3>{title}</h3><p>{note}</p><button type="button" className="insights-sector-action" aria-haspopup="dialog" onClick={(e) => openSector(sector, view, e.currentTarget)}>Open {title}</button></article>)}</section>
    </>}
    <p className="analytics-provenance">Source: {rankings?.meta.source || 'processed Gurgaon listings'} · Historical snapshot, not live inventory.</p>
    {modal && <DetailModal testId="sector-narrative-modal" id="insights-sector-detail" title={TITLES[modal.view]} sector={modal.view === 'methodology' ? undefined : sector || 'All Gurgaon sectors'} trigger={modal.trigger} onClose={close}>
      {modal.view === 'methodology' ? <div className="insights-workspace"><h3>Relative screens, not investment ratings</h3>{Object.entries(rankings?.methodology || {}).map(([key, text]) => <div className="modal-callout" key={key}><strong>{TIERS[key] || key}</strong><p>{text}</p></div>)}<ul className="modal-takeaway-list">{narratives?.takeaways.map((text) => <li key={text}>{text}</li>)}</ul></div> : <Suspense fallback={<div className="advisory-loading" role="status">Loading sector report…</div>}>
        <SectorDetails key={`${propertyType}|${sector}`} sector={sector} propertyType={propertyType} row={row} options={sectorNames} view={modal.view}
          onView={(view) => setModal((previous) => ({ ...previous, view }))} onSector={setSector} notify={notify} onConnection={onConnection}/>
      </Suspense>}
    </DetailModal>}
  </div>;
});
