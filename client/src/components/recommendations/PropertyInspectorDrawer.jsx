import DetailModal from '../DetailModal';
import { areaOf, money, number, priceOf, rateOf } from './format';
export default function PropertyInspectorDrawer({ property, trigger, onClose }) {
  const median = property.sector_median_price_per_sqft;
  const variance = Number.isFinite(median) && median > 0 ? (rateOf(property) / median - 1) * 100 : null;
  const amenities = property.amenities || {};
  return <DetailModal testId="property-inspector-drawer" closeTestId="btn-close-drawer" title="Property Inspector" sector={property.sector} trigger={trigger} onClose={onClose} className="property-inspector-drawer">
    <section aria-label="Selected property details">
      <div className="inspector-core"><span>Selected dataset property</span><strong>{money(priceOf(property))}</strong><div className="inspector-vector">{Number.isFinite(property.vector_match_percentage) ? `${property.vector_match_percentage.toFixed(1)}% Match` : 'Vector score unavailable'}</div></div>
      <div className="inspector-rate"><span>Price / sq ft vs sector median</span><strong>{Number.isFinite(variance) ? `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%` : 'Unavailable'}</strong><p>{Number.isFinite(median) ? `Sector median: ₹${number(Math.round(median))} / sq ft` : 'No sector median provided'}</p></div>
      <dl className="inspector-metadata"><div><dt>Sector investment tier</dt><dd>{property.sector_tier || 'Unranked / insufficient sample'}</dd></div><div><dt>Age / possession</dt><dd>{property.agePossession || 'Not available'}</dd></div><div><dt>Luxury category</dt><dd>{property.luxury_category || 'Not available'}</dd></div><div><dt>Luxury score</dt><dd>{Number.isFinite(property.luxury_score) ? property.luxury_score : 'Not available in dataset'}</dd></div><div><dt>Layout</dt><dd>{property.bedRoom ?? '—'} BHK · {property.bathroom ?? '—'} baths</dd></div><div><dt>Built-up area</dt><dd>{number(areaOf(property))} sq ft</dd></div><div><dt>Floor category</dt><dd>{property.floor_category || 'Not available'}</dd></div><div><dt>Balconies</dt><dd>{property.balcony ?? 'Not available'}</dd></div><div><dt>Furnishing</dt><dd>{property.furnishing_type || 'Not available'}</dd></div><div><dt>Property ID</dt><dd>{property.property_id}</dd></div></dl>
      <h3>Amenity matrix</h3><table className="inspector-amenities"><thead><tr><th>Amenity</th><th>Dataset status</th></tr></thead><tbody>{['Servant room', 'Store room'].map((name) => <tr key={name}><th scope="row">{name}</th><td>{amenities[name] === true ? 'Present' : amenities[name] === false ? 'Absent' : 'Not recorded'}</td></tr>)}</tbody></table>
      <p className="inspector-note">Sector tiers describe the listing snapshot, not investment returns. Possession labels and amenities require verification with the listing source.</p>
      <button type="button" className="ghost-action" onClick={onClose}>Back to Comparison</button>
    </section>
  </DetailModal>;
}
