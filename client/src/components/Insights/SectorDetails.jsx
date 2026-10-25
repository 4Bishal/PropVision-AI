import SectorOverviewMatches from '../Analytics/SectorOverviewMatches';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { request } from '../../api';
import { cr, inr, difference, human, FEATURES, TIERS } from './insightFormat';

export default function SectorDetails({ sector, propertyType, row, options, view, onView, onSector, notify, onConnection }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [feature, setFeature] = useState('furnishing_type');
  const [limited, setLimited] = useState(false);
  const [page, setPage] = useState(0);
  const [alertPage, setAlertPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(null);
    const params = new URLSearchParams(Object.entries({ property_type: propertyType, sector }).filter(([, v]) => v));
    request(`/api/insights/valuation-alerts${params.size ? `?${params}` : ''}`, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.meta || !['sectors', 'layout_comparisons', 'bedroom_comparisons', 'buyer_checklist'].every((key) => Array.isArray(result[key]))) throw new Error('Valuation response is incomplete.');
      setData(result); onConnection();
    }).catch((failure) => { if (!controller.signal.aborted) { setError(failure); notify(failure.message); onConnection(failure); } });
    return () => controller.abort();
  }, [sector, propertyType, revision, notify, onConnection]);
  const comparisons = useMemo(() => (data?.layout_comparisons || []).filter((r) => r.feature === feature && (limited || r.status === 'descriptive')), [data, feature, limited]);
  const bedroomRows = useMemo(() => (data?.bedroom_comparisons || []).filter((r) => r.status === 'descriptive'), [data]);
  const sectorAlerts = useMemo(() => [...(data?.sectors || [])].sort((a, b) => b.relative_iqr - a.relative_iqr), [data]);
  const stats = data?.sectors.find((r) => r.sector === sector);
  return <div className="insights-workspace sector-modal-report">
    <label className="modal-sector-select">Location<select aria-label="Buyer advisory sector" value={sector} onChange={(event) => onSector(event.target.value)}><option value="">All sectors</option>{options.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
    <SectorOverviewMatches key={sector} sector={sector} row={row}>
    <div className="modal-section-tabs" role="group" aria-label="Sector report sections">{[['report', 'Sector report'], ['valuation', 'Valuation Alert'], ['advisory', 'Buyer Advisory']].map(([id, label]) => <button type="button" key={id} className="insights-sector-action" aria-pressed={view === id} onClick={() => onView(id)}>{label}</button>)}</div>
    {error ? <div className="insights-error" role="alert"><p>{error.message}</p><button type="button" onClick={() => setRevision((v) => v + 1)}>Retry sector report</button></div> : !data ? <div className="advisory-loading" role="status">Preparing local price comparisons…</div> : <>
      <p className="modal-snapshot-note"><MapPin size={15}/>{sector || 'Gurgaon'} · {data.meta.filtered_rows} snapshot observations · {propertyType || 'all property types'}</p>
      {view === 'report' && <>
        {row ? <><div className="report-metric-grid"><div><span>Median asking price</span><strong>{cr(row.median_price_cr)}</strong></div><div><span>Average / sq ft</span><strong>{inr(row.avg_price_per_sqft_inr)}</strong></div><div><span>Entry price · lower quartile</span><strong>{cr(row.entry_price_cr)}</strong></div><div><span>Luxury share</span><strong>{row.luxury_share_percent}%</strong></div></div><p>{TIERS[row.tier] || 'Limited sample · unranked'} · {row.dominant_property_type === 'flat' ? 'Flats' : 'Houses'} dominate. Tier scores describe this snapshot, not future returns.</p><h3>Possession-age mix</h3><ul className="modal-takeaway-list">{row.possession_distribution.map((p) => <li key={p.stage}><span>{p.stage}</span><strong>{p.share_percent}% · {p.listing_count} listings</strong></li>)}</ul></> : <p>Select a location to see its complete sector metrics.</p>}
        <div className="modal-callout"><strong>Next step</strong><p>Open Valuation Alert to compare layouts, or Buyer Advisory for the local checklist. Non-under-construction ages do not verify ready-to-move status.</p></div>
      </>}
      {view === 'advisory' && <section className="modal-checklist"><h3>Buyer Advisory Checklist</h3><p>Verify these points for the selected location before shortlisting an individual home.</p><ul>{data.buyer_checklist.map((text) => <li key={text}><CheckCircle2 size={19}/><span>{text}</span></li>)}</ul></section>}
      {view === 'valuation' && <>
        {!sector && <section><h3>Sector price spreads</h3><p>Largest relative middle-price spreads first. A wide spread can reflect property mix, not mispricing.</p><div className="modal-alert-grid">{sectorAlerts.slice(alertPage * 4, alertPage * 4 + 4).map((item) => <article className="modal-callout" key={item.sector}><button type="button" className="insights-sector-action" onClick={() => onSector(item.sector)}>{item.sector}</button><p>{item.listing_count} observations · {item.limited_sample ? 'Limited sample' : 'Descriptive only'}</p><strong>{cr(item.q1_price_cr)} – {cr(item.q3_price_cr)}</strong><p>Under construction: {item.under_construction_share_percent}%</p></article>)}</div>{sectorAlerts.length > 4 && <div className="compact-pagination"><button type="button" disabled={!alertPage} onClick={() => setAlertPage((p) => p - 1)}>Previous alerts</button><span>Page {alertPage + 1} of {Math.ceil(sectorAlerts.length / 4)}</span><button type="button" disabled={(alertPage + 1) * 4 >= sectorAlerts.length} onClick={() => setAlertPage((p) => p + 1)}>Next alerts</button></div>}</section>}
        {stats && <div className="report-metric-grid"><div><span>Middle 50% of prices</span><strong>{cr(stats.q1_price_cr)} – {cr(stats.q3_price_cr)}</strong></div><div><span>Under construction</span><strong>{stats.under_construction_share_percent}%</strong></div><div><span>Price variance</span><strong>{stats.price_variance_cr2} Cr²</strong></div><div><span>Sample context</span><strong>{stats.limited_sample ? 'Limited evidence' : 'Descriptive only'}</strong></div></div>}
        <h3>Layout asking-price comparison</h3><p>{data.methodology}</p><label className="modal-sector-select">Compare feature<select aria-label="Valuation feature" value={feature} onChange={(e) => { setFeature(e.target.value); setPage(0); }}>{Object.entries(FEATURES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="utility-exploratory-toggle"><input type="checkbox" checked={limited} onChange={(e) => { setLimited(e.target.checked); setPage(0); }}/> Include limited and unavailable comparisons (exploratory only)</label>
        <div className="table-scroll"><table><caption className="sr-only">Observed layout asking-price comparisons</caption><thead><tr><th>Home</th><th>Baseline → comparison</th><th>Listings</th><th>Median prices</th><th>Difference</th><th>Evidence</th></tr></thead><tbody>{comparisons.slice(page * 8, page * 8 + 8).map((r) => <tr key={`${r.sector}-${r.property_type}-${r.bhk}-${r.comparison}`}><td><button type="button" className="insights-sector-action" onClick={() => onSector(r.sector)}>{r.sector}</button><br/>{r.property_type} · {r.bhk} BHK</td><td>{human(r.baseline)} → {human(r.comparison)}</td><td>{r.baseline_count} / {r.comparison_count}</td><td>{cr(r.baseline_median_cr)} / {cr(r.comparison_median_cr)}</td><td>{difference(r.difference_cr)}</td><td>{r.status === 'descriptive' ? 'Descriptive only' : r.status === 'limited' ? 'Insufficient evidence' : 'Missing group'}</td></tr>)}</tbody></table></div>
        {!comparisons.length && <p className="insights-empty">No comparisons meet the sample requirement. Try another feature or inspect limited samples.</p>}
        {comparisons.length > 8 && <div className="compact-pagination"><button type="button" disabled={!page} onClick={() => setPage((p) => p - 1)}>Previous comparisons</button><span>Page {page + 1} of {Math.ceil(comparisons.length / 8)}</span><button type="button" disabled={(page + 1) * 8 >= comparisons.length} onClick={() => setPage((p) => p + 1)}>Next comparisons</button></div>}
        <p className="modal-snapshot-note">Negative differences are retained. These are group associations, not causal premiums.</p>
        <h3>One extra bedroom</h3>{bedroomRows.length ? <><p>First {Math.min(6, bedroomRows.length)} of {bedroomRows.length} descriptive comparisons. Select a sector to narrow the list.</p><ul className="modal-takeaway-list">{bedroomRows.slice(0, 6).map((r) => <li key={`${r.sector}-${r.property_type}-${r.from_bhk}`}><span><button type="button" className="insights-sector-action" onClick={() => onSector(r.sector)}>{r.sector}</button> · {r.property_type} · {r.from_bhk} → {r.to_bhk} BHK</span><strong>{difference(r.difference_cr)}</strong></li>)}</ul></> : <p>No adjacent-bedroom comparisons have 5+ listings per group.</p>}
      </>}
    </>}

    </SectorOverviewMatches>
  </div>;
}
