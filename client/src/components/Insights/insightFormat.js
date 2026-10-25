export const TIERS = { premium: 'Premium Luxury', value: 'Growth Corridor', affordable: 'Affordable Entry' };
export const FEATURES = { furnishing_type: 'Furnishing', 'servant room': 'Servant room', floor_category: 'Floor height' };
export const cr = (value) => value == null ? 'Unavailable' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
export const inr = (value) => value == null ? 'Unavailable' : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const difference = (value) => value == null ? 'Not comparable' : `${value < 0 ? '−' : value > 0 ? '+' : ''}${cr(Math.abs(value))}`;
export const human = (value) => value === 0 ? 'Without room' : value === 1 ? 'With room' : value;
