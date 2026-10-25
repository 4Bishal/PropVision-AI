import { createContext, memo, useCallback, useContext, useMemo, useState } from 'react';
import AnalyticsDetailDialog from './AnalyticsDetailDialog';

const DetailContext = createContext(null);

export function CardDetailsProvider({ children }) {
  const [expandedCard, setExpandedCard] = useState(null);
  const toggle = useCallback((id, title, content, trigger) => {
    setExpandedCard((current) => current?.id === id ? null : { id, title, content, trigger });
  }, []);
  const close = useCallback(() => setExpandedCard(null), []);
  const value = useMemo(() => ({ expandedCardId: expandedCard?.id ?? null, toggle, close }), [expandedCard?.id, toggle, close]);
  return <DetailContext.Provider value={value}>{children}
    {expandedCard && <AnalyticsDetailDialog cardId={expandedCard.id} title={expandedCard.title} trigger={expandedCard.trigger} onClose={close}>{expandedCard.content}</AnalyticsDetailDialog>}
  </DetailContext.Provider>;
}

export const CardDetailButton = memo(function CardDetailButton({ cardId, title, children, label = 'View Detail' }) {
  const context = useContext(DetailContext);
  if (!context) return null;
  const active = context.expandedCardId === cardId;
  return <button type="button" className="card-detail-button" aria-label={`${label}: ${title}`}
    aria-expanded={active} aria-haspopup="dialog" aria-controls={active ? 'analytics-card-detail' : undefined}
    onClick={(event) => context.toggle(cardId, title, typeof children === 'function' ? children(context.close) : children, event.currentTarget)}>
    <span>{label}</span><span className="detail-indicator">{active ? 'Inspecting' : 'Explore'} ↗</span>
  </button>;
});

export function KpiDetails({ metric, kpi }) {
  const explanations = {
    'Dataset listings': 'The number of observations matching the active filters. This is a processed dataset snapshot, not live inventory.',
    'Average listing price': 'The arithmetic mean of matching listing prices in INR crores. Very high-priced properties can influence this average.',
    'Median price / sq ft': 'The median of each listing’s INR price divided by its built-up area in square feet. This is not a ratio of aggregate averages.',
    'Top luxury sector': 'The sector with the most Luxury-tier observations under the active filters. It does not identify the most expensive sector.',
  };
  return <div className="kpi-detail-body"><p>{explanations[metric]}</p>
    <div className="detail-stat-grid"><div><span>Selected listings</span><strong>{kpi.total_listings.toLocaleString('en-IN')}</strong></div><div><span>Average price</span><strong>{kpi.avg_price_cr == null ? '—' : `₹${kpi.avg_price_cr.toFixed(4)} Cr`}</strong></div><div><span>Median INR / sq ft</span><strong>{kpi.median_price_per_sqft_inr == null ? '—' : `₹${kpi.median_price_per_sqft_inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}</strong></div></div>
    <h3>Property-type breakdown</h3><div className="table-scroll"><table><thead><tr><th>Property type</th><th>Observations</th><th>Average price (Cr)</th></tr></thead><tbody>{kpi.avg_price_by_property_type.map((row) => <tr key={row.property_type}><td>{row.property_type}</td><td>{row.listing_count}</td><td>{row.avg_price_cr}</td></tr>)}</tbody></table></div>
    <p>Active selection: {Object.values(kpi.meta.filters || {}).filter(Boolean).join(' · ') || 'All properties, tiers and sectors'}.</p>
  </div>;
}
