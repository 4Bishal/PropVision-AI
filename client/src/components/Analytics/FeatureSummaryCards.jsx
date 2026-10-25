import { lazy, memo, useMemo } from 'react';
import { ArrowUpRight, Building2, DoorOpen, Layers, LayoutGrid } from 'lucide-react';
import { CardDetailButton } from './CardDetails';
import { comparisonStatus } from './utilityComparison';

const FeatureDetail = lazy(() => import('./FeatureCharts'));
const CONFIG = [
  { id: 'floor', title: 'Floor Category & Height', eyebrow: 'VERTICAL VALUE', icon: Building2, description: 'Compare floor categories by price and price density.' },
  { id: 'utility', title: 'Utility Room Price Comparison', eyebrow: 'ASKING-PRICE CONTEXT', icon: DoorOpen, description: 'Compare homes with and without utility rooms. Small samples are separated from the main chart.' },
  { id: 'balcony', title: 'Balcony & Layout', eyebrow: 'SPACE & DESIGN', icon: LayoutGrid, description: 'Explore price, variance and volume across balcony counts.' },
  { id: 'positioning', title: 'Luxury × Possession', eyebrow: 'MARKET POSITIONING', icon: Layers, description: 'Compare lifestyle tiers across five possession stages.' },
];

function FeatureSummaryCards({ data, errorPanel }) {
  const summaries = useMemo(() => ({
    floor: `${(data.floor?.groups || []).filter((g) => g.listing_count > 0).length} floor / type groups`,
    utility: `${(data.utility?.groups || []).filter((g) => comparisonStatus(g) === 'available').length} comparisons with 5+ per group`,
    balcony: `${new Set((data.balcony?.groups || []).filter((g) => g.listing_count > 0).map((g) => g.balcony)).size} balcony categories`,
    positioning: `${(data.positioning?.cells || []).filter((g) => g.listing_count > 0).length} populated segments`,
  }), [data.floor, data.utility, data.balcony, data.positioning]);
  return <section className="feature-intelligence" aria-labelledby="feature-intelligence-title"><div className="analytics-section-intro"><div><span className="eyebrow">LOOK CLOSER AT THE DETAILS</span><h2 id="feature-intelligence-title">Detailed Feature Intelligence</h2></div><span className="snapshot-pill">All active filters applied</span></div>
    <div className="intelligence-grid grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {CONFIG.map(({ id, title, eyebrow, icon: Icon, description }) => data[id] ? <article className="analytics-card feature-summary-card" key={id} data-feature-id={id}>
        <div className="feature-summary-top"><Icon size={21}/><ArrowUpRight size={16}/></div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3><strong>{summaries[id]}</strong><p>{description}</p>
        <CardDetailButton cardId={`feature-${id}`} title={title}><FeatureDetail cardId={id} data={data[id]}/></CardDetailButton>
      </article> : <div className="feature-summary-card" key={id}>{errorPanel(id)}</div>)}
    </div>
  </section>;
}
export default memo(FeatureSummaryCards);
