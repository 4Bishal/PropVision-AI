import { Minus, Plus, ChevronDown, LoaderCircle } from 'lucide-react';

export function Select({ label, name, testId, options = [], value, onChange, disabled, placeholder = 'Select an option' }) {
  return <label className="field"><span>{label}</span><div className="relative">
    <select data-testid={testId} className="bg-surface-card text-text-main focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" name={name} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} required>
      <option value="" disabled>{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select><ChevronDown size={15} className="select-chevron" aria-hidden="true"/>
  </div></label>;
}

export function Counter({ label, value, onChange, min = 1, max = 100, disabled = false }) {
  return <div className="field"><span id={`${label.replaceAll(' ', '-')}-label`}>{label}</span>
    <div className="counter" role="group" aria-labelledby={`${label.replaceAll(' ', '-')}-label`}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Number(value) - 1)}><Minus size={15}/></button>
      <input className="bg-surface-card text-text-main focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" aria-label={label} type="number" min={min} max={max} step="1" required value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}/>
      <button type="button" aria-label={`Increase ${label}`} disabled={disabled || value >= max} onClick={() => onChange(Number(value) + 1)}><Plus size={15}/></button>
    </div>
  </div>;
}

export function SubmitButton({ loading, children, loadingText, disabled, icon: Icon, testId }) {
  return <button data-testid={testId} type="submit" className="primary-button bg-brand-accent hover:bg-amber-700 text-white font-semibold shadow-md" disabled={disabled || loading}>
    {loading ? <LoaderCircle size={18} className="animate-spin"/> : Icon && <Icon size={18}/>}
    {loading ? loadingText : children}<span className="ml-auto" aria-hidden="true">↗</span>
  </button>;
}
