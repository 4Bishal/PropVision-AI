import { memo, useMemo, useState } from 'react';
import { comparisonStatus, MIN_COMPARISON_LISTINGS } from './utilityComparison';
import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const PRICE_METRICS = {
  median_price_cr: { label: 'Median price (₹ Cr)', format: (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 4 })} Cr` },
  median_price_per_sqft_inr: { label: 'Median price / sq ft', format: (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / sq ft` },
};
const UPLIFT_METRICS = {
  observed_price_difference_cr: { label: 'Median difference (₹ Cr)', format: (v) => `${v > 0 ? '+' : ''}₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 4 })} Cr` },
  observed_difference_percent: { label: 'Median difference (%)', format: (v) => `${v > 0 ? '+' : ''}${v}%` },
  observed_density_difference_inr: { label: 'Price / sq ft difference', format: (v) => `${v > 0 ? '+' : ''}₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / sq ft` },
};
const BALCONY_METRICS = { ...PRICE_METRICS,
  price_variance_cr2: { label: 'Price variance (Cr²)', format: (v) => `${v} Cr²` },
  listing_count: { label: 'Listing count', format: (v) => `${v} listings` },
};
const NA = 'Not available';

export function pivotGroups(groups, dimension, metric) {
  const rows = new Map();
  for (const group of groups) {
    const label = String(group[dimension]);
    if (!rows.has(label)) rows.set(label, { label });
    rows.get(label)[group.property_type] = group[metric];
  }
  return [...rows.values()];
}

const GroupedBars = memo(function GroupedBars({ rows, formatter, label }) {
  return <div className="chart-canvas intelligence-chart" role="img" aria-label={label}><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 10, left: 0, right: 10, bottom: 12 }}><CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="label" tick={{ fill: 'var(--chart-muted)', fontSize: 10 }}/><YAxis tick={{ fill: 'var(--chart-muted)', fontSize: 10 }} width={50}/><ReferenceLine y={0} stroke="var(--chart-muted)"/><Tooltip contentStyle={{ background: 'var(--chart-card)', color: 'var(--chart-text)', border: '1px solid var(--chart-grid)', borderRadius: 8, fontSize: 11 }} formatter={(value, name) => [formatter(value), name]}/><Legend iconType="circle" wrapperStyle={{ fontSize: 10 }}/><Bar dataKey="flat" name="Flats" fill="var(--chart-primary)" maxBarSize={35} radius={[3, 3, 0, 0]} isAnimationActive={false}/><Bar dataKey="house" name="Houses" fill="var(--chart-accent)" maxBarSize={35} radius={[3, 3, 0, 0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>;
});

function MetricSelect({ label, value, onChange, options }) {
  return <label className="intelligence-select">{label}<select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{Object.entries(options).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>;
}

function DistributionTable({ groups, dimension, dimensionLabel }) {
  return <div className="data-details"><h3 className="detail-section-title">Exact statistics & sample sizes</h3><div className="table-scroll"><table><thead><tr><th>{dimensionLabel}</th><th>Type</th><th>n</th><th>Median Cr</th><th>Median INR/sq ft</th><th>Variance Cr²</th></tr></thead><tbody>{groups.map((g) => <tr key={`${g[dimension]}:${g.property_type}`}><td>{g[dimension]}</td><td>{g.property_type}</td><td>{g.listing_count}</td><td>{g.median_price_cr ?? '—'}</td><td>{g.median_price_per_sqft_inr ?? '—'}</td><td>{g.price_variance_cr2 ?? '—'}</td></tr>)}</tbody></table></div></div>;
}

export function FloorIntelligence({ data }) {
  const [metric, setMetric] = useState('median_price_cr');
  const values = useMemo(() => pivotGroups(data.groups, 'floor_category', metric), [data.groups, metric]);
  return <section className="analytics-card"><div className="chart-heading"><div><span className="eyebrow">FLOOR CATEGORY & HEIGHT IMPACT</span><h2>Value, at every level</h2><p>Low-Rise, Mid-Rise and High-Rise · segmented by property type</p></div></div><MetricSelect label="Floor chart metric" value={metric} onChange={setMetric} options={PRICE_METRICS}/><GroupedBars rows={values} formatter={PRICE_METRICS[metric].format} label={`Floor category: ${PRICE_METRICS[metric].label}`}/><DistributionTable groups={data.groups} dimension="floor_category" dimensionLabel="Floor category"/><p className="analytics-footnote">Category associations only; height effects are not isolated from sector, area or luxury.</p></section>;
}

export function UtilityIntelligence({ data }) {
  const [room, setRoom] = useState('servant room');
  const [metric, setMetric] = useState('observed_price_difference_cr');
  const [bhk, setBhk] = useState('');
  const [showLimited, setShowLimited] = useState(false);
  const rows = useMemo(() => data.groups.filter((g) => g.room === room && (!bhk || String(g.bhk) === bhk)), [data.groups, room, bhk]);
  const { values, available, limited, unavailable } = useMemo(() => {
    const available = rows.filter((r) => comparisonStatus(r) === 'available');
    const limited = rows.filter((r) => comparisonStatus(r) === 'limited');
    const chartRows = rows.filter((r) => comparisonStatus(r) === 'available' || (showLimited && comparisonStatus(r) === 'limited'));
    return { values: pivotGroups(chartRows.map((r) => ({ ...r, bhk: `${r.bhk} BHK` })), 'bhk', metric),
      available, limited, unavailable: rows.length - available.length - limited.length };
  }, [rows, metric, showLimited]);
  const sizes = useMemo(() => [...new Set(data.groups.map((g) => g.bhk))].sort((a, b) => a - b), [data.groups]);
  const price = (value) => value == null ? 'Unavailable' : `\u20B9${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 4 })} Cr`;
  return <section className="analytics-card"><div className="chart-heading"><div><span className="eyebrow">UTILITY ROOM PRICE COMPARISON</span><h2>Compare the asking price, in context</h2><p>Median asking price with a room minus without it, within the same property type and BHK.</p></div></div>
    <div className="utility-context"><strong>A room is one part of a home's value</strong><p>Location, built-up area, condition and luxury tier also affect asking prices. A negative bar means the with-room group has a lower median; it does not mean removing a room would increase a home's value.</p></div>
    <div className="intelligence-controls"><label className="intelligence-select">Utility room<select aria-label="Utility room" value={room} onChange={(e) => setRoom(e.target.value)}><option value="servant room">Servant room</option><option value="store room">Store room</option></select></label><label className="intelligence-select">BHK cohort<select aria-label="Utility BHK cohort" value={bhk} onChange={(e) => setBhk(e.target.value)}><option value="">All sizes</option>{sizes.map((v) => <option value={v} key={v}>{v} BHK</option>)}</select></label><MetricSelect label="Utility difference metric" value={metric} onChange={setMetric} options={UPLIFT_METRICS}/></div>
    <div className="utility-sample-summary" role="status"><span>{available.length} comparisons with 5+ listings per group</span><span>{limited.length} limited-sample comparisons</span><span>{unavailable} missing a comparison group</span></div>
    <label className="utility-exploratory-toggle"><input type="checkbox" checked={showLimited} onChange={(e) => setShowLimited(e.target.checked)}/> Include limited samples in chart (exploratory only)</label>
    {showLimited && limited.length > 0 && <p className="utility-sample-warning">Exploratory view: some bars use fewer than {MIN_COMPARISON_LISTINGS} listings in a group. Do not interpret them as a room premium or discount.</p>}
    {values.length ? <GroupedBars rows={values} formatter={UPLIFT_METRICS[metric].format} label={`Utility room observed difference: ${UPLIFT_METRICS[metric].label}`}/> : <div className="utility-chart-empty"><h3>Not enough comparable listings for this chart</h3><p>Try another BHK size or room type. Raw group medians remain available below; missing comparisons are never shown as zero.</p></div>}
    <div className="data-details"><h3 className="detail-section-title">Group medians & sample sizes</h3><p>These are different homes, grouped by type and BHK; they are not matched-property valuations. BHK is bedroom count, not a property ID.</p><div className="table-scroll"><table><thead><tr><th>BHK</th><th>Property type</th><th>Without room: listings</th><th>With room: listings</th><th>Without room: median</th><th>With room: median</th><th>Observed difference</th><th>Comparison context</th></tr></thead><tbody>{rows.map((r) => {
      const status = comparisonStatus(r);
      return <tr key={`${r.property_type}:${r.bhk}`}><td>{r.bhk} BHK</td><td>{r.property_type === 'house' ? 'House' : 'Flat'}</td><td>{r.without_room.listing_count}</td><td>{r.with_room.listing_count}</td><td>{price(r.without_room.median_price_cr)}</td><td>{price(r.with_room.median_price_cr)}</td><td>{status === 'unavailable' ? 'Not comparable' : `${r.observed_price_difference_cr < 0 ? '-' : r.observed_price_difference_cr > 0 ? '+' : ''}${price(Math.abs(r.observed_price_difference_cr))}`}</td><td><span className={`utility-sample-badge ${status}`}>{status === 'unavailable' ? 'Missing comparison group' : status === 'limited' ? 'Limited sample: insufficient evidence' : '5+ per group: descriptive only'}</span></td></tr>;
    })}</tbody></table></div></div><p className="analytics-footnote">The 5-listing minimum is a display safeguard, not proof of statistical significance. Differences are observed associations, not causal uplift or renovation returns. Compare similar local properties before making a pricing decision.</p>
  </section>;
}

export function BalconyIntelligence({ data }) {
  const [metric, setMetric] = useState('median_price_cr');
  const values = useMemo(() => pivotGroups(data.groups, 'balcony', metric), [data.groups, metric]);
  return <section className="analytics-card"><div className="chart-heading"><div><span className="eyebrow">BALCONY & LAYOUT DISTRIBUTION</span><h2>A little more breathing room</h2><p>Compare 0, 1, 2, 3 and 3+ balconies</p></div></div><MetricSelect label="Balcony chart metric" value={metric} onChange={setMetric} options={BALCONY_METRICS}/><GroupedBars rows={values} formatter={BALCONY_METRICS[metric].format} label={`Balcony count: ${BALCONY_METRICS[metric].label}`}/><DistributionTable groups={data.groups} dimension="balcony" dimensionLabel="Balconies"/><p className="analytics-footnote">Asking-price patterns from the processed sample, not measured buyer valuations.</p></section>;
}

export function PositioningMatrix({ data }) {
  const { max, cells } = useMemo(() => ({ max: Math.max(0, ...data.cells.map((c) => c.median_price_cr || 0)),
    cells: new Map(data.cells.map((cell) => [`${cell.luxury_category}:${cell.agePossession}`, cell])) }), [data.cells]);
  return <section className="analytics-card"><div className="chart-heading"><div><span className="eyebrow">LUXURY × POSSESSION</span><h2>Where lifestyle meets lifecycle</h2><p>Median price in ₹ Cr · counts shown in every cell</p></div></div><div className="table-scroll"><table className="positioning-matrix"><thead><tr><th>Luxury tier</th>{data.age_categories.map((age) => <th key={age}>{age}</th>)}</tr></thead><tbody>{data.luxury_categories.map((tier) => <tr key={tier}><th>{tier}</th>{data.age_categories.map((age) => {
    const cell = cells.get(`${tier}:${age}`);
    const intensity = cell?.median_price_cr != null && max ? .08 + .85 * cell.median_price_cr / max : 0;
    return <td key={age}><div tabIndex={0} title={`${tier}, ${age}: median ${cell?.median_price_cr ?? NA} Cr, n=${cell?.listing_count ?? 0}`} style={{ background: intensity ? `color-mix(in srgb, var(--chart-primary) ${intensity * 100}%, var(--chart-card))` : 'var(--chart-soft)', color: intensity > .5 ? 'var(--chart-on-primary)' : 'var(--chart-text)' }}><strong>{cell?.median_price_cr != null ? `₹${cell.median_price_cr.toFixed(2)}` : '—'}</strong><small>n = {cell?.listing_count ?? 0}</small></div></td>;
  })}</tr>)}</tbody></table></div><p className="analytics-footnote">Stronger navy/blue shading = higher observed median. Empty cells are unavailable, not zero-priced properties.</p></section>;
}

const VIEWS = {
  floor: memo(FloorIntelligence), utility: memo(UtilityIntelligence),
  balcony: memo(BalconyIntelligence), positioning: memo(PositioningMatrix),
};
export default function FeatureDetail({ cardId, data }) {
  const View = VIEWS[cardId];
  return View ? <View data={data}/> : null;
}
