import { ShieldCheck, Building2, Ruler } from 'lucide-react';
import { number } from './recommendations/format';
const currency = (value) => Number.isFinite(value) ? `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}` : 'Unavailable';
const crore = (value) => Number.isFinite(value) ? `₹${(value / 1e7).toFixed(2)} Cr` : 'Unavailable';
export default function ValuationResult({ result }) {
  const price = result.predicted_price_inr;
  const area = result.input.built_up_area;
  const interval = result.valuation_range;
  const valid = Number.isFinite(interval?.lower_bound) && Number.isFinite(interval?.upper_bound);
  return <section className="minimal-valuation" aria-label="Property valuation result">
    <div className="minimal-valuation-primary"><h2>Estimated valuation</h2><strong data-testid="predicted-price-value" className="minimal-valuation-price">{crore(price)}</strong>
      {valid ? <><p data-testid="prediction-interval-bounds" className="statistical-range-pill"><ShieldCheck size={16} aria-hidden="true"/>80% CI: {crore(interval.lower_bound)} – {crore(interval.upper_bound)}</p><span className="statistical-microtag">Calculated via XGBoost Cross-Validation Quantile Residuals (MAE: {interval.mae_pct.toFixed(1)}%)</span></> : <p>Statistical prediction interval unavailable for this model bundle.</p>}
    </div>
    <dl className="minimal-stat-tiles"><div><dt><Ruler size={15} aria-hidden="true"/>Implied Rate / Sq.Ft</dt><dd>{currency(price / area)}</dd></div><div><dt><Building2 size={15} aria-hidden="true"/>Built-up Area</dt><dd>{number(area)} sq.ft</dd></div><div><dt>Model Log Residual Error</dt><dd>{Number.isFinite(interval?.q90_residual) ? `±${interval.q90_residual.toFixed(4)}` : 'Unavailable'}</dd><small>Q90 of CV log residuals; interval uses Q10/Q90.</small></div></dl>
  </section>;
}
