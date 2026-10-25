import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import RecommendationCarousel from '../components/recommendations/RecommendationCarousel';
import RecommendationFeed from '../components/recommendations/RecommendationFeed';
import { request } from '../api';
vi.mock('../api', () => ({ request: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const property = { property_id: 'sample:1', price_inr: 8500000, built_up_area: 1800,
  bedRoom: 3, bathroom: 2, sector: 'sector 104', match_percentage: 91, vector_match_percentage: 88.4,
  property_type: 'flat', key_feature_tags: ['Luxury'], floor_category: 'High-Rise' };

test('carousel compares numeric differences and closes its accessible modal', () => {
  render(<RecommendationCarousel title="Matching homes" properties={[property]}
    currentProperty={{ price_inr: 10000000, built_up_area: 1500, bedRoom: 3 }}/>);
  expect(screen.getByText('88.4% Match')).toBeInTheDocument();
  expect(screen.getByText('₹85 Lakhs')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect & Compare' }));
  const dialog = screen.getByRole('dialog', { name: 'Property comparison' });
  expect(within(dialog).getByRole('cell', { name: /85 Lakhs/ })).toBeInTheDocument();
  expect(within(dialog).getByText(/Price:.*15 Lakhs lower/)).toBeInTheDocument();
  expect(within(dialog).getByRole('cell', { name: /1,800 sq ft/ })).toBeInTheDocument();
  expect(within(dialog).getByRole('row', { name: /Sector Tier/ })).toHaveTextContent('Not available');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Select & Inspect Property' }));
  const inspector = screen.getByRole('dialog', { name: 'Property Inspector' });
  expect(within(inspector).getByRole('region', { name: 'Selected property details' })).toHaveTextContent('sample:1');
  expect(within(dialog).getByRole('button', { name: 'Currently Inspecting' })).toBeDisabled();
  fireEvent.click(within(inspector).getByRole('button', { name: 'Back to Comparison' }));
  expect(screen.queryByRole('dialog', { name: 'Property Inspector' })).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  expect(within(dialog).getByRole('button', { name: 'Select & Inspect Property' })).toBeEnabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close', exact: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('feed aborts obsolete contexts and ignores late responses', async () => {
  let resolveFirst;
  request.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce([property]);
  const { rerender } = render(<RecommendationFeed specs={{ sector: 'sector 5' }} title="Homes"/>);
  const firstSignal = request.mock.calls[0][1].signal;
  rerender(<RecommendationFeed specs={{ sector: 'sector 104' }} title="Homes"/>);
  expect(firstSignal.aborted).toBe(true);
  expect(await screen.findByText('88.4% Match')).toBeInTheDocument();
  resolveFirst([]);
  await waitFor(() => expect(screen.getByText('88.4% Match')).toBeInTheDocument());
  expect(request.mock.calls[1][1].body).toEqual({ sector: 'sector 104', top_n: 6 });
});

test('feed supports similar requests, errors, retry and empty results', async () => {
  request.mockRejectedValueOnce(new Error('Service unavailable')).mockResolvedValueOnce([]);
  render(<RecommendationFeed propertyId={0} title="Similar homes"/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  expect(request.mock.calls[0][0]).toBe('/api/recommend/similar');
  expect(request.mock.calls[0][1].body.property_id).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Retry recommendations' }));
  expect(await screen.findByText(/No properties match/)).toBeInTheDocument();
});

test('minimal feed stays inline without a decorative drawer or callout', async () => {
  request.mockResolvedValueOnce([property]);
  render(<RecommendationFeed specs={{ sector: 'sector 104' }}/>);
  expect(await screen.findByText('88.4% Match')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText(/RADAR/)).not.toBeInTheDocument();
});

test('value anchor appears only for a calculated rate below the sector average', () => {
  const { rerender } = render(<RecommendationCarousel properties={[{ ...property, sector_avg_price_per_sqft: 6000 }]}/>);
  expect(screen.getByText('Under Sector Avg')).toBeInTheDocument();
  rerender(<RecommendationCarousel properties={[{ ...property, sector_avg_price_per_sqft: 4000 }]}/>);
  expect(screen.queryByText('Under Sector Avg')).not.toBeInTheDocument();
});
