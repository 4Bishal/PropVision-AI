import { memo, useMemo, useState } from 'react';
import { CardDetailButton } from './CardDetails';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['var(--chart-primary)', 'var(--chart-accent)', 'var(--chart-muted)'];
const AXIS = { fontSize: 10, fill: 'var(--chart-muted)' };
const tooltipStyle = { backgroundColor: 'var(--chart-card)', border: '1px solid var(--chart-grid)', borderRadius: 8, color: 'var(--chart-text)', fontSize: 12 };

function ScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="chart-tooltip"><strong>{point.sector}</strong><span>₹{point.price_cr.toFixed(2)} Cr · {point.built_up_area.toLocaleString('en-IN')} sq ft</span><small>{point.property_type} · {point.furnishing_type}</small></div>;
}

function AreaScatterView({ data, propertyType, onPropertyType, detail = false }) {
  const [groupBy, setGroupBy] = useState('furnishing_type');
  const groups = useMemo(() => {
    const names = groupBy === 'property_type' ? ['flat', 'house'] : data.furnishing_types;
    const buckets = new Map(names.map((name) => [name, []]));
    for (const point of data.price_vs_area) buckets.get(point[groupBy])?.push(point);
    return names.map((name) => ({ name, points: buckets.get(name) }));
  }, [data.price_vs_area, data.furnishing_types, groupBy]);
  return <section className="analytics-card scatter-panel"><div className="chart-heading"><div><span className="eyebrow">SPACE & VALUE</span><h2>How much does space matter?</h2><p>Built-up area vs listing price · {data.price_vs_area.length.toLocaleString('en-IN')} observations</p></div><span className="correlation-badge">r = {data.price_area_pearson_r?.toFixed(2) ?? '—'}</span></div>
    <div className="chart-controls"><div className="segmented" aria-label="Scatter property type">{[['', 'All'], ['flat', 'Flats'], ['house', 'Houses']].map(([value, label]) => <button key={value} aria-pressed={propertyType === value} onClick={() => onPropertyType(value)}>{label}</button>)}</div><label>Color by <select aria-label="Scatter color grouping" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="furnishing_type">Furnishing</option><option value="property_type">Property type</option></select></label></div>
    <div className="chart-canvas" role="img" aria-label="Scatter chart of built-up area in square feet against price in crores"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 12, right: 15, bottom: 25, left: 8 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis type="number" dataKey="built_up_area" name="Built-up area" tick={AXIS} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} label={{ value: 'Built-up area (sq ft)', position: 'bottom', fontSize: 10, fill: 'var(--chart-muted)', offset: 5 }}/><YAxis type="number" dataKey="price_cr" name="Price" tick={AXIS} width={45} tickFormatter={(v) => `₹${v}`} label={{ value: 'Cr', position: 'insideTopLeft', fill: 'var(--chart-muted)', fontSize: 10 }}/><Tooltip content={<ScatterTooltip/>}/><Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 20 }}/>{groups.map(({ name, points }, i) => <Scatter key={name} name={name} data={points} fill={COLORS[i % COLORS.length]} fillOpacity={.55} isAnimationActive={false}/>)}</ScatterChart></ResponsiveContainer></div>
    {detail ? <div className="data-details"><h3 className="detail-section-title">View first 20 observations as a table</h3><div className="table-scroll"><table><thead><tr><th>Sector</th><th>Type</th><th>Area (sq ft)</th><th>Price (Cr)</th></tr></thead><tbody>{data.price_vs_area.slice(0, 20).map((p) => <tr key={p.row_id}><td>{p.sector}</td><td>{p.property_type}</td><td>{p.built_up_area}</td><td>{p.price_cr}</td></tr>)}</tbody></table></div></div> : <CardDetailButton cardId="area-scatter" title="Price vs Built-up Area">{(close) => <AreaScatter data={data} propertyType={propertyType} detail onPropertyType={(value) => { close(); onPropertyType(value); }}/>}</CardDetailButton>}
  </section>;
}

function SectorChartView({ data, onSelectSector, detail = false }) {
  return <section className="analytics-card"><div className="chart-heading"><div><span className="eyebrow">LOCATION PREMIUM</span><h2>The sector price spectrum</h2><p>Top 15 sectors by median listing price</p></div><span className="small-pill">₹ Cr</span></div>
    <div className="chart-canvas sector-chart" role="img" aria-label="Top 15 sectors by median price in crores"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.sectors} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 0 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" horizontal={false}/><XAxis type="number" tick={AXIS}/><YAxis type="category" dataKey="sector" width={92} tick={AXIS} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${Number(v).toFixed(2)} Cr`, 'Median price']}/><Bar dataKey="median_price_cr" radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false}>{data.sectors.map((s, i) => <Cell key={s.sector} fill={i < 3 ? 'var(--chart-accent)' : 'var(--chart-primary)'}/>)}</Bar></BarChart></ResponsiveContainer></div>
    {detail ? <div className="data-details"><h3 className="detail-section-title">Sector directory & sample sizes</h3><div className="sector-directory">{data.sectors.map((s) => <button key={s.sector} onClick={() => onSelectSector(s.sector)}><span>{s.sector} <small>n={s.listing_count}</small></span><strong>₹{s.median_price_cr.toFixed(2)} Cr</strong></button>)}</div></div> : <CardDetailButton cardId="sector-comparison" title="Sector Price Comparison">{(close) => <SectorChart data={data} detail onSelectSector={(value) => { close(); onSelectSector(value); }}/>}</CardDetailButton>}
    <p className="analytics-footnote">Small sector samples can produce unstable rankings. Inspect listing counts before comparing.</p>
  </section>;
}

function DistributionChartView({ title, subtitle, rows, detail = false }) {
  const values = useMemo(() => rows.map((row) => ({ ...row, ...Object.fromEntries(row.by_property_type.map((p) => [p.property_type, p.median_price_cr])) })), [rows]);
  return <section className="analytics-card"><div className="chart-heading"><div><span className="eyebrow">PROPERTY COMPOSITION</span><h2>{title}</h2><p>{subtitle}</p></div></div><div className="chart-canvas distribution-chart" role="img" aria-label={`${title}, median prices by property type`}><ResponsiveContainer width="100%" height="100%"><BarChart data={values} margin={{ top: 10, left: 0, bottom: 40, right: 10 }}><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="category" tick={{ ...AXIS, fontSize: 9 }} interval={0} angle={-18} textAnchor="end" height={60}/><YAxis tick={AXIS} width={40}/><Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [`₹${Number(v).toFixed(2)} Cr`, name]}/><Legend wrapperStyle={{ fontSize: 10 }} iconType="circle"/><Bar dataKey="flat" name="Flats" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}/><Bar dataKey="house" name="Houses" fill="var(--chart-accent)" radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>
    {detail ? <div className="data-details"><h3 className="detail-section-title">View distribution statistics</h3><div className="table-scroll"><table><thead><tr><th>Category</th><th>n</th><th>Median Cr</th><th>25th–75th percentile Cr</th></tr></thead><tbody>{rows.map((r) => <tr key={r.category}><td>{r.category}</td><td>{r.listing_count}</td><td>{r.median_price_cr.toFixed(2)}</td><td>{r.q1_price_cr.toFixed(2)}–{r.q3_price_cr.toFixed(2)}</td></tr>)}</tbody></table></div></div> : <CardDetailButton cardId={`distribution-${title}`} title={title}><DistributionChart title={title} subtitle={subtitle} rows={rows} detail/></CardDetailButton>}
  </section>;
}

export const AreaScatter = memo(AreaScatterView);
export const SectorChart = memo(SectorChartView);
export const DistributionChart = memo(DistributionChartView);
