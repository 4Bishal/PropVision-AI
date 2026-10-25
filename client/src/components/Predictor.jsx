import ValuationResult from './ValuationResult';
import RecommendationFeed from './recommendations/RecommendationFeed';
import { useRef, useState, useEffect } from 'react';
import { request, predictionPayload } from '../api';
import { Counter, Select, SubmitButton } from './FormControls';

const initial = { property_type: '', sector: '', bedRoom: 3, bathroom: 2, balcony: '',
  agePossession: '', built_up_area: 1500, 'servant room': 0, 'store room': 0,
  furnishing_type: '', floor_category: '', luxury_category: '' };
const labels = { property_type: 'Property type', sector: 'Location / sector', balcony: 'Balconies',
  agePossession: 'Property age', furnishing_type: 'Furnishing', floor_category: 'Floor Category', luxury_category: 'Luxury Rating' };

export default function Predictor({ schema, notify, onConnection }) {
  const [values, setValues] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [focused, setFocused] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const formRef = useRef(null);
  const summaryRef = useRef(null);
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!focused) return;
    summaryRef.current?.focus({ preventScroll: true });
    summaryRef.current?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [focused]);
  const edit = () => { setFocused(false); requestAnimationFrame(() => formRef.current?.querySelector('select')?.focus()); };
  const set = (key, value) => setValues((previous) => ({ ...previous, [key]: value }));
  const options = schema?.categories || {};
  const disabled = !schema || loading;

  async function submit(event) {
    event.preventDefault(); setLoading(true);
    const controller = new AbortController(); active.current = controller;
    try {
      const payload = predictionPayload(values);
      setSubmitted(payload); setFocused(true);
      const data = await request('/api/predict', { body: payload, signal: controller.signal });
      if (!Number.isFinite(data.predicted_price_inr) || typeof data.formatted_price !== 'string') throw new Error('The prediction response is incomplete. Please retry.');
      setResult({ ...data, input: payload }); onConnection();
    } catch (error) {
      if (error.name !== 'AbortError') { setFocused(false); notify(error.message); onConnection(error); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const select = (key) => <Select key={key} label={labels[key]} name={key} testId={`select-${key.replaceAll("_", "-")}`} options={options[key]} value={values[key]} onChange={(value) => set(key, value)} disabled={disabled}/>;

  const price = result?.predicted_price_inr;
  return <div className="predictor-stream">
    {focused && submitted && <div data-testid="compact-summary-bar" className="active-specs-bar" ref={summaryRef} tabIndex={-1}><p><span>Active Specs</span> {submitted.bedRoom} BHK, {submitted.sector}, {Number(submitted.built_up_area).toLocaleString('en-IN')} sq.ft</p><button type="button" onClick={edit}>Edit Parameters</button></div>}
    <form ref={formRef} hidden={focused} className="panel predictor-form" onSubmit={submit} aria-label="House price predictor">
      <header className="predictor-form-header"><div><h2>Property valuation</h2><p>Enter the property details used by the model.</p></div></header>
      <fieldset disabled={disabled} className="predictor-input-grid">
        <legend className="sr-only">Property details</legend>
        {select('sector')}{select('property_type')}
        <Counter label="Bedrooms" value={values.bedRoom} onChange={(v) => set('bedRoom', v)}/>
        <Counter label="Bathrooms" value={values.bathroom} onChange={(v) => set('bathroom', v)}/>
        <label className="field"><span>Built-up area <small>sq ft</small></span><div className="relative"><input data-testid="input-built-up-area" name="built_up_area" type="number" min="1" step="any" required value={values.built_up_area} onChange={(e) => set('built_up_area', e.target.value)}/><span className="input-unit">sq ft</span></div></label>
        {select('balcony')}{select('agePossession')}{select('furnishing_type')}{select('luxury_category')}{select('floor_category')}
        {['servant room', 'store room'].map((key) => <label className="toggle-field" key={key}><span>{key === 'servant room' ? 'Servant room' : 'Store room'}<small>Additional space</small></span><input type="checkbox" checked={values[key] === 1} onChange={(e) => set(key, e.target.checked ? 1 : 0)}/><span className="toggle-track" aria-hidden="true"/></label>)}
      </fieldset>
      <div className="form-bottom"><span>All 12 property features included</span><SubmitButton testId="btn-calculate-valuation" loading={loading} loadingText="Estimating your property..." disabled={!schema}>Calculate Valuation</SubmitButton></div>
    </form>
    {loading && <p role="status" className="minimal-calculation-status">Calculating valuation...</p>}
    {result && !loading && <>
      <ValuationResult key={JSON.stringify(result)} result={result}/>
      <RecommendationFeed title="AI Matched Property Listings"
        specs={{ sector: result.input.sector, price, bedRoom: result.input.bedRoom,
          built_up_area: result.input.built_up_area, luxury_category: result.input.luxury_category }}
        currentProperty={{ ...result.input, price_inr: price }}/>
    </>}
    <p className="fine-print">Trained on 3,554 Gurgaon properties. Actual prices depend on current market conditions and individual details.</p>
  </div>;
}
