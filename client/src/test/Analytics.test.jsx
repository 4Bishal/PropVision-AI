import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import AnalyticsDashboard from '../components/Analytics/AnalyticsDashboard';

vi.mock('../components/Analytics/GeoMap', () => ({ default: ({ onOpenSectorInsights }) => <button onClick={() => onOpenSectorInsights('sector 56')}>Explore map sector 56</button> }));
vi.mock('../components/Analytics/RelationshipCharts', () => ({
  AreaScatter: () => <div>Area scatter chart</div>,
  SectorChart: () => <div>Sector median chart</div>,
  DistributionChart: ({ title }) => <div>{title}</div>,
}));
vi.mock('../components/Analytics/FeatureIntelligence', () => ({ default: () => <div>Detailed Feature Intelligence</div> }));
const meta = { dataset_rows: 3554, filtered_rows: 3554, snapshot: true };
const kpis = { meta, total_listings: 3554, sector_count: 115, avg_price_cr: 2.4415,
  median_price_per_sqft_inr: 9540.22, top_luxury_sector: { sector: 'sector 102', listing_count: 52 },
  avg_price_by_property_type: [{ property_type: 'flat', avg_price_cr: 1.72, listing_count: 2804 }] };
const payloads = {
  kpis,
  geospatial: { meta, sectors: [], unmapped_sectors: [] },
  'sector-breakdown': { meta, sectors: [] },
  'floor-price-density': { meta, groups: [] },
  'utility-room-premium': { meta, groups: [] },
  'balcony-distribution': { meta, groups: [] },
  'luxury-vs-possession': { meta, cells: [], luxury_categories: [], age_categories: [] },
  'feature-correlations': { meta, price_vs_area: [], price_area_pearson_r: .7,
    luxury_distribution: [], age_distribution: [], floor_distribution: [], furnishing_types: [] },
};
const props = { schema: { categories: { sector: ['sector 56'], luxury_category: ['Standard', 'Premium', 'Luxury'] } }, notify: vi.fn(), onConnection: vi.fn(), onOpenSectorInsights: vi.fn() };
const respond = (data, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => data });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn((url) => respond(payloads[new URL(url).pathname.split('/').pop()])));
});

test('loads and displays real API KPI payloads with snapshot context', async () => {
  render(<AnalyticsDashboard {...props}/>);
  expect(await screen.findByText('3,554', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText('₹2.44 Cr')).toBeInTheDocument();
  expect(screen.getByText('sector 102', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.queryByText('Area scatter chart')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Detail: Price vs Built-up Area' }));
  expect(await screen.findByText('Area scatter chart')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close detail view' }));
  expect(await screen.findByText('The lifestyle premium')).toBeInTheDocument();
  expect(screen.getByText(/Snapshot, not live inventory/)).toBeInTheDocument();
});

test('property/luxury filters are sent to every panel', async () => {
  render(<AnalyticsDashboard {...props}/>);
  await screen.findByText('3,554', { selector: 'strong' });
  fetch.mockClear();
  fireEvent.change(screen.getByLabelText('Analytics property type'), { target: { value: 'house' } });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(8));
  expect(fetch.mock.calls.every(([url]) => new URL(url).searchParams.get('property_type') === 'house')).toBe(true);
  await screen.findByText('3,554', { selector: 'strong' });
  fetch.mockClear();
  fireEvent.change(screen.getByLabelText('Analytics luxury tier'), { target: { value: 'Luxury' } });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(8));
  expect(fetch.mock.calls.every(([url]) => new URL(url).searchParams.get('luxury_category') === 'Luxury')).toBe(true);
});

test('map action forwards the sector to Insights without changing Analytics filters', async () => {
  render(<AnalyticsDashboard {...props}/>);
  fireEvent.click(await screen.findByRole('button', { name: 'Explore map sector 56' }));
  expect(props.onOpenSectorInsights).toHaveBeenCalledWith('sector 56');
  expect(screen.getByLabelText('Analytics sector')).toHaveValue('');
});

test('a failed panel preserves successful data and offers retry', async () => {
  fetch.mockImplementation((url) => new URL(url).pathname.endsWith('/geospatial')
    ? respond({ error: { message: 'Map data is temporarily unavailable', code: 'ML_UNAVAILABLE' } }, 503)
    : respond(payloads[new URL(url).pathname.split('/').pop()]));
  render(<AnalyticsDashboard {...props}/>);
  expect(await screen.findByText('3,554', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText('Map data is temporarily unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry data' })).toBeInTheDocument();
  expect(screen.queryByText('Area scatter chart')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Detail: Price vs Built-up Area' }));
  expect(await screen.findByText('Area scatter chart')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close detail view' }));
});

test('empty filter selections never imply a fabricated zero market price', async () => {
  fetch.mockImplementation((url) => respond(new URL(url).pathname.endsWith('/kpis')
    ? { ...kpis, total_listings: 0, avg_price_cr: null, median_price_per_sqft_inr: null, top_luxury_sector: null }
    : payloads[new URL(url).pathname.split('/').pop()]));
  render(<AnalyticsDashboard {...props}/>);
  expect(await screen.findByText('No properties match this selection')).toBeInTheDocument();
  expect(screen.queryByText('₹0.00 Cr')).not.toBeInTheDocument();
});

test('market insights describe observed data without claiming time trends', async () => {
  render(<AnalyticsDashboard {...props} insights/>);
  expect(await screen.findByText('A measured view of the market')).toBeInTheDocument();
  expect(screen.getByText(/association, not a causal effect/)).toBeInTheDocument();
});

test('analytics and insights reuse datasets, filters and the mounted map', async () => {
  const view = render(<AnalyticsDashboard {...props}/>);
  await screen.findByRole('button', { name: 'Explore map sector 56' });
  fireEvent.change(screen.getByLabelText('Analytics property type'), { target: { value: 'house' } });
  await screen.findByText('3,554', { selector: 'strong' });
  await screen.findByRole('button', { name: 'Explore map sector 56' });
  const requests = fetch.mock.calls.length;
  const mountedMap = screen.getByRole('button', { name: 'Explore map sector 56' });
  view.rerender(<AnalyticsDashboard {...props} insights/>);
  expect(screen.getByLabelText('Analytics property type')).toHaveValue('house');
  expect(fetch).toHaveBeenCalledTimes(requests);
  view.rerender(<AnalyticsDashboard {...props} insights={false}/>);
  expect(screen.getByRole('button', { name: 'Explore map sector 56' })).toBe(mountedMap);
  expect(fetch).toHaveBeenCalledTimes(requests);
});
