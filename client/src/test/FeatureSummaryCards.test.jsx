import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import FeatureSummaryCards from '../components/Analytics/FeatureSummaryCards';
import { CardDetailsProvider } from '../components/Analytics/CardDetails';

vi.mock('../components/Analytics/FeatureCharts', () => ({ default: ({ cardId }) => <p>{cardId} detailed chart</p> }));

test('four summary cards remain in their grid while only selected chart loads in the portal', async () => {
  const { container } = render(<CardDetailsProvider><FeatureSummaryCards data={{
    floor: { groups: [] }, utility: { groups: [] }, balcony: { groups: [] }, positioning: { cells: [] },
  }} errorPanel={() => null}/></CardDetailsProvider>);
  const grid = container.querySelector('.intelligence-grid');
  expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4', 'gap-6');
  expect(grid.children).toHaveLength(4);
  expect(screen.queryByText('floor detailed chart')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Detail: Floor Category & Height' }));
  expect(await within(screen.getByRole('dialog')).findByText('floor detailed chart')).toBeInTheDocument();
  expect(grid.children).toHaveLength(4);
  expect(grid).not.toContainElement(screen.getByRole('dialog'));
  expect(screen.queryByText('balcony detailed chart')).not.toBeInTheDocument();
});
