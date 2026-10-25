import { Check } from 'lucide-react';
import PropertyInspectorDrawer from './PropertyInspectorDrawer';
import { useState } from 'react';
import DetailModal from '../DetailModal';
import { areaOf, money, number, priceOf, rateOf } from './format';
const dimensions = [
  ['Price', priceOf, money, 'lower'],
  ['Price/sqft', rateOf, (v) => Number.isFinite(v) ? `₹${number(Math.round(v))}` : 'Not available', 'lower'],
  ['BHK', (p) => p.bedRoom, number, 'higher'],
  ['Area', areaOf, (v) => Number.isFinite(v) ? `${number(v)} sq ft` : 'Not available', 'higher'],
  ['Floor Category', (p) => p.floor_category],
  ['Luxury Category', (p) => p.luxury_category],
  ['Sector Tier', (p) => p.sector_tier],
  ['Amenities', (p) => (p.amenity_highlights || p.key_feature_tags || []).join(', ') || undefined],
];
export default function PropertyComparisonModal({ current = {}, property, trigger, onClose, onInspect }) {
  const [inspecting, setInspecting] = useState(null);
  const delta = (a, b, format) => Number.isFinite(a) && Number.isFinite(b)
    ? `${format(Math.abs(b - a))} ${b === a ? 'same' : b > a ? 'higher' : 'lower'}` : 'Reference unavailable';
  return <DetailModal testId="property-comparison-modal" title="Property comparison" sector={property.sector} trigger={trigger} onClose={onClose} className="recommendation-modal executive-comparison">
    <div className="comparison-split-heading"><div><span>Your Target/Predicted Specs</span><strong>{money(priceOf(current))}</strong><p>{current.sector || 'Active context'}</p></div><div><span>Selected AI Recommended Property</span><strong>{money(priceOf(property))}</strong><p>{property.sector}</p></div></div>
    <div className="comparison-variance-chips"><span>Price: {delta(priceOf(current), priceOf(property), money)}</span><span>Price / sq ft: {delta(rateOf(current), rateOf(property), (v) => `₹${number(Math.round(v))}`)}</span></div>
    <div className="table-scroll"><table data-testid="comparison-grid" className="recommendation-comparison"><thead><tr><th>Metric</th><th>Your Target/Predicted Specs</th><th>Selected Property</th></tr></thead><tbody>{dimensions.map(([label, get, format, preference]) => {
      const a = get(current); const b = get(property);
      const numeric = Number.isFinite(a) && Number.isFinite(b);
      const favorable = numeric && (preference === 'lower' ? b < a : preference === 'higher' && b > a);
      const matching = a !== undefined && a !== '' && a === b;
      const display = (value) => format ? format(value) : value ?? 'Not available';
      return <tr key={label}><th scope="row">{label}</th><td className="comparison-target">{display(a)}</td><td className="comparison-recommended">{display(b)}{numeric && a !== b && <span className={favorable ? 'comparison-delta favorable-delta' : 'comparison-delta neutral-delta'}>{delta(a, b, format || number)}</span>}{matching && <span className="comparison-match-pill">Matches target</span>}</td></tr>;
    })}</tbody></table></div>
    {inspecting && <PropertyInspectorDrawer property={property} trigger={inspecting} onClose={() => { const button = inspecting; setInspecting(null); requestAnimationFrame(() => button?.focus()); }}/>}
    <footer className="comparison-actions"><button type="button" data-testid="btn-select-inspect" className="copper-action" disabled={Boolean(inspecting)} onClick={(event) => { setInspecting(event.currentTarget); onInspect?.(property); }}>{inspecting ? <><Check size={16} aria-hidden="true"/>Currently Inspecting</> : 'Select & Inspect Property'}</button><button type="button" className="ghost-action" onClick={onClose}>Close</button></footer>
  </DetailModal>;
}
