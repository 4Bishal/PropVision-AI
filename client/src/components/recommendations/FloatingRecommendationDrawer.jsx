import { useState } from 'react';
import { Radar, ArrowRight } from 'lucide-react';
import DetailModal from '../DetailModal';
import RecommendationCarousel from './RecommendationCarousel';
import PropertyComparisonModal from './PropertyComparisonModal';
import { money, priceOf, areaOf, number } from './format';

export default function FloatingRecommendationDrawer({ properties = [], currentProperty, loading, error, onRetry, autoOpen = false }) {
  const [open, setOpen] = useState(autoOpen);
  const [details, setDetails] = useState(null);
  const [trigger, setTrigger] = useState(null);
  return <>
    <button type="button" className="floating-matches-trigger" aria-haspopup="dialog" aria-expanded={open}
      onClick={(event) => { setTrigger(event.currentTarget); setOpen(true); }}><Radar size={22}/><span>✨ AI Property Matches ({properties.length})</span><ArrowRight size={18}/></button>
    {open && <DetailModal title="Your AI Property Matches" trigger={trigger} onClose={() => setOpen(false)} className="recommendation-drawer">
      <p className="drawer-intro">Your next shortlist starts here. Inspect the strongest matches and compare the details.</p>
      <div className="drawer-match-list">{properties.slice(0, 3).map((property) => <div key={property.property_id} className="drawer-match-preview">
        <div className="match-ring" style={{ '--match': `${property.match_percentage}%`, '--ring-color': property.match_percentage > 85 ? '#2563EB' : '#C2410C' }}><span>{property.match_percentage}<small>% match</small></span></div>
        <div><strong>{property.sector}</strong><p>{money(priceOf(property))} · {number(areaOf(property))} sq ft</p><button type="button" onClick={(event) => setDetails({ property, trigger: event.currentTarget })}>View Details <ArrowRight size={14}/></button></div>
      </div>)}</div>
      <RecommendationCarousel title="Top matches · compare your shortlist" properties={properties} currentProperty={currentProperty} loading={loading} error={error} onRetry={onRetry}/>
      {details && <PropertyComparisonModal current={currentProperty} property={details.property} trigger={details.trigger} onClose={() => setDetails(null)}/>}
    </DetailModal>}
  </>;
}
