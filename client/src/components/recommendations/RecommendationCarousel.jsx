import { useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Compass } from 'lucide-react';
import PropertyCard from './PropertyCard';
import PropertyComparisonModal from './PropertyComparisonModal';

export default function RecommendationCarousel({ title, properties = [], currentProperty = {}, loading, error, onRetry }) {
  const list = useRef(null);
  const id = useId();
  const [selected, setSelected] = useState(null);
  const scroll = (direction) => list.current?.scrollBy({ left: direction * list.current.clientWidth * .85,
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  return <section data-testid="recommendation-carousel" className="recommendation-section" aria-labelledby={id} aria-busy={loading}>
    <header className="recommendation-heading"><div><h3 id={id}><Compass className="w-5 h-5 text-[#C2410C]" aria-hidden="true"/>{title || 'Similar Properties by Vector Cosine Distance'}</h3><p>{loading ? 'Finding matching properties…' : `${properties.length} matching properties`} · Dataset snapshot</p></div>
      {!loading && properties.length > 0 && <div className="flex gap-2"><button type="button" aria-label="Previous recommendations" onClick={() => scroll(-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="Next recommendations" onClick={() => scroll(1)}><ChevronRight size={18}/></button></div>}
    </header>
    {loading ? <div role="status" className="recommendation-placeholder">Finding homes that fit your context…</div> : error ? <div role="alert" className="recommendation-placeholder"><p>{error.message}</p><button type="button" onClick={onRetry}>Retry recommendations</button></div> : !properties.length ? <p className="recommendation-placeholder">No properties match this context. Try another sector or budget.</p> : <div ref={list} className="recommendation-track" tabIndex={0} aria-label="Recommended properties">{properties.map((property) => <PropertyCard key={property.property_id} property={property} onCompare={(item, trigger) => setSelected({ item, trigger })}/>)}</div>}
    {selected && <PropertyComparisonModal current={currentProperty} property={selected.item} trigger={selected.trigger} onClose={() => setSelected(null)}/>}
  </section>;
}
