import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import RecommendationCarousel from '../components/recommendations/RecommendationCarousel';
const property = { property_id: 'dataset:42', sector: 'sector 54', price_inr: 12000000,
  built_up_area: 1500, bedRoom: 3, bathroom: 2, vector_match_percentage: 94.2,
  sector_median_price_per_sqft: 10000, sector_tier: 'Premium Luxury', agePossession: 'Relatively New',
  luxury_category: 'Luxury', amenities: { 'Servant room': true, 'Store room': false } };

test('inspector exposes sector variance and recorded amenities; Escape preserves parent lock', () => {
  render(<RecommendationCarousel properties={[property]} currentProperty={{ price_inr: 15000000, built_up_area: 1400 }}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Inspect & Compare' }));
  const parent = screen.getByRole('dialog', { name: 'Property comparison' });
  expect(within(parent).getByText(/100 sq ft higher/)).toHaveClass('favorable-delta');
  fireEvent.click(within(parent).getByRole('button', { name: 'Select & Inspect Property' }));
  const drawer = screen.getByRole('dialog', { name: 'Property Inspector' });
  expect(within(drawer).getByText('-20.0%')).toBeInTheDocument();
  expect(within(drawer).getByText('Premium Luxury')).toBeInTheDocument();
  expect(within(drawer).getByText('Relatively New')).toBeInTheDocument();
  expect(within(drawer).getByRole('row', { name: 'Servant room Present' })).toBeInTheDocument();
  expect(within(drawer).getByRole('row', { name: 'Store room Absent' })).toBeInTheDocument();
  expect(within(drawer).getByText('Not available in dataset')).toBeInTheDocument();
  fireEvent(drawer, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog', { name: 'Property Inspector' })).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(parent).getByRole('button', { name: 'Select & Inspect Property' }));
  expect(screen.getByRole('dialog', { name: 'Property Inspector' })).toBeInTheDocument();
});
