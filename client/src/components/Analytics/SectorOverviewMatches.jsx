import { Compass } from 'lucide-react';
import { useId, useState } from 'react';
import RecommendationFeed from '../recommendations/RecommendationFeed';
import { money, number } from '../recommendations/format';

export default function SectorOverviewMatches({ row, sector, children }) {
  const [tab, setTab] = useState('overview');
  const id = useId();
  return <section className="sector-compact-panel">
    <div className="sector-panel-tabs" role="tablist" aria-label="Sector overview and recommendations">{[['overview', 'Sector & Property Analytics'], ['matches', 'Recommended Market Alternatives']].map(([key, label]) => <button key={key} id={`${id}-${key}`} type="button" role="tab" aria-selected={tab === key} aria-controls={`${id}-panel-${key}`} onClick={() => setTab(key)} onKeyDown={(event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'matches' : tab === 'overview' ? 'matches' : 'overview';
        setTab(next); document.getElementById(`${id}-${next}`)?.focus();
      }
    }} tabIndex={tab === key ? 0 : -1}>{key === 'matches' && <Compass size={16} aria-hidden="true"/>}{label}</button>)}</div>
    <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-${tab}`}>
      {tab === 'overview' ? <><dl className="compact-property-grid"><div><dt>Total properties</dt><dd>{number(row?.listing_count)}</dd></div><div><dt>Average price / sq ft</dt><dd>{Number.isFinite(row?.avg_price_per_sqft_inr) ? `₹${number(Math.round(row.avg_price_per_sqft_inr))}` : 'Not available'}</dd></div><div><dt>Median asking price</dt><dd>{money(row?.median_price_cr * 1e7)}</dd></div><div><dt>Luxury share</dt><dd>{row?.luxury_share_percent != null ? `${row.luxury_share_percent}%` : 'Not available'}</dd>{Number.isFinite(row?.luxury_share_percent) && <meter className="sector-share-bar" min="0" max="100" value={row.luxury_share_percent} aria-label="Luxury share"/>}</div></dl>{children}</> : <RecommendationFeed title={`Recommended Market Alternatives in ${sector || 'Gurgaon'}`} specs={{ sector }} currentProperty={{ sector, price_inr: row?.median_price_cr * 1e7, price_per_sqft: row?.avg_price_per_sqft_inr }}/>}
    </div>
  </section>;
}
