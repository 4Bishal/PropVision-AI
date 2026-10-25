export const money = (value) => Number.isFinite(value) ? `₹${Number((value / (value >= 1e7 ? 1e7 : 1e5)).toFixed(2))} ${value >= 1e7 ? 'Cr' : 'Lakhs'}` : 'Not available';
export const number = (value) => Number.isFinite(value) ? value.toLocaleString('en-IN') : 'Not available';
export const priceOf = (property) => property?.price_inr ?? property?.predicted_price_inr ?? property?.price;
export const areaOf = (property) => property?.built_up_area ?? property?.area;
export const rateOf = (property) => property?.price_per_sqft ?? (priceOf(property) > 0 && areaOf(property) > 0 ? priceOf(property) / areaOf(property) : undefined);
