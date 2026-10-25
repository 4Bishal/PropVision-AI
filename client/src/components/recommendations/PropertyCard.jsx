import { Building2, GitCompare, Ruler, Target } from 'lucide-react';
import { areaOf, money, number, priceOf } from './format';
export default function PropertyCard({ property, onCompare }) {
  const vector = property.vector_match_percentage;
  const price = priceOf(property);
  const area = areaOf(property);
  const average = property.sector_avg_price_per_sqft;
  const belowAverage = average > 0 && area > 0 && price / area < average;
  return <article data-testid="property-card" className="recommendation-card">
    <span data-testid="vector-match-badge" className="vector-match-pill"><Target size={14} aria-hidden="true"/><span>AI VECTOR MATCH<strong>{Number.isFinite(vector) ? `${vector.toFixed(1)}% Match` : 'Score unavailable'}</strong></span></span>
    <header className="minimal-property-heading"><h3>{property.sector}</h3><span><Building2 size={14} aria-hidden="true"/>{property.bedRoom ?? '—'} BHK</span></header>
    <strong className="recommendation-price">{price >= 1e7 ? `₹${(price / 1e7).toFixed(2)} Cr` : money(price)}</strong>
    {belowAverage && <span className="sector-value-tag" title="Implied price per sq ft is below the same sector's dataset average">Under Sector Avg</span>}
    <p className="property-area"><Ruler size={14} aria-hidden="true"/>{number(area)} sq ft</p>
    <button type="button" data-testid="btn-inspect-compare" className="recommendation-compare" onClick={(event) => onCompare(property, event.currentTarget)}><GitCompare size={16} aria-hidden="true"/>Inspect &amp; Compare</button>
  </article>;
}
