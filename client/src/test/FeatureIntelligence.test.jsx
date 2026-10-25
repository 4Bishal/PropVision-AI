import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { BalconyIntelligence, FloorIntelligence, PositioningMatrix, UtilityIntelligence, pivotGroups } from '../components/Analytics/FeatureCharts';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ data, children }) => <div><output data-testid="chart-data">{JSON.stringify(data)}</output>{children}</div>,
  Bar: () => null, CartesianGrid: () => null, Legend: () => null, ReferenceLine: () => null,
  Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));
const summary = { listing_count: 10, median_price_cr: 2, median_price_per_sqft_inr: 10000, price_variance_cr2: .25 };

test('floor metric selector changes price to density without zero-filling missing values', () => {
  render(<FloorIntelligence data={{ groups: [{ ...summary, floor_category: 'Low-Rise', property_type: 'flat' },
    { ...summary, floor_category: 'Low-Rise', property_type: 'house', median_price_cr: null, median_price_per_sqft_inr: null }] }}/>);
  fireEvent.change(screen.getByLabelText('Floor chart metric'), { target: { value: 'median_price_per_sqft_inr' } });
  expect(JSON.parse(screen.getByTestId('chart-data').textContent)).toEqual([{ label: 'Low-Rise', flat: 10000, house: null }]);
});

test('limited samples are withheld from the default chart but preserved for exploration', () => {
  const row = { property_type: 'flat', bhk: 3, room: 'store room', with_room: { listing_count: 2, median_price_cr: 1 },
    without_room: { listing_count: 8, median_price_cr: 1.25 }, observed_price_difference_cr: -.25,
    observed_difference_percent: -20, observed_density_difference_inr: -500, small_sample: true };
  render(<UtilityIntelligence data={{ groups: [row, { ...row, bhk: 2, observed_price_difference_cr: null }] }}/>);
  fireEvent.change(screen.getByLabelText('Utility room'), { target: { value: 'store room' } });
  fireEvent.change(screen.getByLabelText('Utility BHK cohort'), { target: { value: '3' } });
  expect(screen.queryByTestId('chart-data')).not.toBeInTheDocument();
  expect(screen.getByText('Not enough comparable listings for this chart')).toBeInTheDocument();
  expect(screen.getByText('Limited sample: insufficient evidence')).toBeInTheDocument();
  expect(screen.getByText(/not causal uplift/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Include limited samples/ }));
  expect(JSON.parse(screen.getByTestId('chart-data').textContent)).toEqual([{ label: '3 BHK', flat: -.25 }]);
  fireEvent.change(screen.getByLabelText('Utility difference metric'), { target: { value: 'observed_difference_percent' } });
  expect(JSON.parse(screen.getByTestId('chart-data').textContent)[0]).toEqual({ label: '3 BHK', flat: -20 });
});

test('10-BHK house comparison discloses raw medians without implying a room discount', () => {
  render(<UtilityIntelligence data={{ groups: [{ property_type: 'house', bhk: 10, room: 'servant room',
    with_room: { listing_count: 4, median_price_cr: 5.2 }, without_room: { listing_count: 8, median_price_cr: 7.5 },
    observed_price_difference_cr: -2.3 }] }}/>);
  expect(screen.queryByTestId('chart-data')).not.toBeInTheDocument();
  expect(screen.getByText('₹5.2 Cr')).toBeInTheDocument();
  expect(screen.getByText('₹7.5 Cr')).toBeInTheDocument();
  expect(screen.getByText('-₹2.3 Cr')).toBeInTheDocument();
  expect(screen.getByText(/does not mean removing a room/)).toBeInTheDocument();
});

test('adequate descriptive groups retain negative bars and missing groups never become zero', () => {
  render(<UtilityIntelligence data={{ groups: [{ property_type: 'house', bhk: 3, room: 'servant room',
    with_room: { listing_count: 5, median_price_cr: 2 }, without_room: { listing_count: 6, median_price_cr: 3 },
    observed_price_difference_cr: -1 }, { property_type: 'house', bhk: 10, room: 'servant room',
    with_room: { listing_count: 0, median_price_cr: null }, without_room: { listing_count: 12, median_price_cr: 7.5 },
    observed_price_difference_cr: null }] }}/>);
  expect(JSON.parse(screen.getByTestId('chart-data').textContent)).toEqual([{ label: '3 BHK', house: -1 }]);
  expect(screen.getByText('Missing comparison group')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Include limited samples/ }));
  expect(JSON.parse(screen.getByTestId('chart-data').textContent)).toEqual([{ label: '3 BHK', house: -1 }]);
});

test('balcony variance is interactive and preserves 3+ as a separate category', () => {
  render(<BalconyIntelligence data={{ groups: [{ ...summary, balcony: '3+', property_type: 'house' }] }}/>);
  fireEvent.change(screen.getByLabelText('Balcony chart metric'), { target: { value: 'price_variance_cr2' } });
  expect(JSON.parse(screen.getByTestId('chart-data').textContent)).toEqual([{ label: '3+', house: .25 }]);
});

test('luxury-possession matrix distinguishes missing cohorts from zero', () => {
  render(<PositioningMatrix data={{ luxury_categories: ['Luxury'], age_categories: ['Old Property', 'New Property'],
    cells: [{ luxury_category: 'Luxury', agePossession: 'Old Property', listing_count: 5, median_price_cr: 4 },
      { luxury_category: 'Luxury', agePossession: 'New Property', listing_count: 0, median_price_cr: null }] }}/>);
  expect(screen.getByText('₹4.00')).toBeInTheDocument();
  expect(screen.getByText('n = 0')).toBeInTheDocument();
  expect(screen.queryByText('₹0.00')).not.toBeInTheDocument();
});

test('pivot never substitutes missing comparisons with a positive premium', () => {
  expect(pivotGroups([{ bhk: 2, property_type: 'flat', observed_price_difference_cr: null }], 'bhk', 'observed_price_difference_cr'))
    .toEqual([{ label: '2', flat: null }]);
});
