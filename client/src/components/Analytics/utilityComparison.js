// Display safeguard, not a statistical significance or valuation threshold.
export const MIN_COMPARISON_LISTINGS = 5;

export function comparisonStatus(row) {
  const without = row.without_room.listing_count;
  const withRoom = row.with_room.listing_count;
  if (!without || !withRoom || row.observed_price_difference_cr == null) return 'unavailable';
  return Math.min(without, withRoom) < MIN_COMPARISON_LISTINGS ? 'limited' : 'available';
}
