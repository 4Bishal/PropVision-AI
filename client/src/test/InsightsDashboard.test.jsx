import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import InsightsDashboard from '../components/Insights/InsightsDashboard';

const meta = { filtered_rows: 20, source: 'snapshot.csv' };
const sectorRow = { sector: 'sector 56', listing_count: 20, tier: 'premium', score: 90,
  median_price_cr: 3, avg_price_per_sqft_inr: 12000, entry_price_cr: 2, luxury_share_percent: 30,
  dominant_property_type: 'flat', possession_distribution: [{ stage: 'New Property', listing_count: 20, share_percent: 100 }] };
const rankings = { meta, sectors: [sectorRow, { ...sectorRow, sector: 'sector 5', tier: 'affordable' }], limited_sample_sectors: [], methodology: { premium: 'Relative price and luxury share.', value: 'Price/space and volume proxy.' } };
const narratives = { meta, title: 'Your executive market brief', generation: 'Deterministic templates; no external AI model.',
  bullets: [{ id: 'density', badge: 'Premium benchmark', sector: 'sector 56', text: 'Sector 56 leads this selected snapshot.' }],
  takeaways: ['No growth forecast is available.'] };
const comparison = { sector: 'sector 56', property_type: 'flat', bhk: 3, feature: 'furnishing_type',
  baseline: 'unfurnished', comparison: 'furnished', baseline_count: 8, comparison_count: 6,
  baseline_median_cr: 3, comparison_median_cr: 2, difference_cr: -1, difference_percent: -33.33, status: 'descriptive' };
const alerts = { meta, sectors: [{ sector: 'sector 56', relative_iqr: .8, q1_price_cr: 2, q3_price_cr: 4,
  price_variance_cr2: 1, listing_count: 20, under_construction_count: 5, under_construction_share_percent: 25, non_under_construction_count: 15 }],
  layout_comparisons: [comparison, { ...comparison, bhk: 10, baseline_count: 8, comparison_count: 4, status: 'limited' }],
  bedroom_comparisons: [], buyer_checklist: ['Verify the original listing and property documents.'],
  methodology: 'Same sector, type and BHK. Area is uncontrolled.' };
const notify = vi.fn(), onConnection = vi.fn();
const json = (data, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => data });
function response(url) {
  if (url.includes('/api/recommend/')) return json([]);
  if (url.includes('sector-rankings')) return json(rankings);
  if (url.includes('summary-narratives')) return json(narratives);
  return json(alerts);
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn(response)); });
afterEach(() => vi.unstubAllGlobals());
const mount = () => render(<InsightsDashboard notify={notify} onConnection={onConnection}/>);

test('overview is compact and valuation data is fetched only when a modal opens', async () => {
  const { container } = mount();
  expect(screen.getByRole('status', { name: 'Loading market insights' })).toBeInTheDocument();
  await screen.findByRole('heading', { name: 'Your executive market brief' });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText('Buyer Advisory Checklist')).not.toBeInTheDocument();
  const grid = container.querySelector('.compact-sector-grid');
  const cards = [...grid.children];
  const trigger = screen.getByRole('button', { name: 'View Sector Details for sector 56' });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Sector Details' });
  expect(dialog.parentElement).toBe(document.body);
  expect(dialog).toHaveClass('max-w-4xl');
  expect(await within(dialog).findByText('₹2 Cr')).toBeInTheDocument();
  expect(within(dialog).getByText('Active Sector: sector 56')).toBeInTheDocument();
  expect([...grid.children]).toEqual(cards);
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close detail view' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).not.toHaveFocus();
  expect(document.body.style.overflow).toBe('unset');
});

test('sector-specific valuation and buyer advisory buttons open their corresponding modal views', async () => {
  mount(); await screen.findByRole('heading', { name: 'Find your market position' });
  fireEvent.click(screen.getByRole('button', { name: 'Valuation Alert for sector 56' }));
  const dialog = screen.getByRole('dialog', { name: 'Valuation Alert' });
  expect(await within(dialog).findByText('−₹1 Cr')).toBeInTheDocument();
  expect(within(dialog).queryByText('Insufficient evidence')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /Include limited and unavailable/ }));
  expect(within(dialog).getByText('Insufficient evidence')).toBeInTheDocument();
  const requests = fetch.mock.calls.length;
  fireEvent.click(within(dialog).getByRole('button', { name: 'Buyer Advisory', exact: true }));
  expect(within(dialog).getByText('Verify the original listing and property documents.')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(requests);
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Buyer Advisory for sector 5' }));
  expect(await screen.findByText('Verify the original listing and property documents.')).toBeInTheDocument();
  expect(screen.getByText('Active Sector: sector 5')).toBeInTheDocument();
});

test('live search highlights suggestions and keyboard selection opens the exact sector without scrolling', async () => {
  mount(); await screen.findByRole('heading', { name: 'Find your market position' });
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  try {
    const input = screen.getByRole('combobox', { name: 'Search sector reports' });
    fireEvent.change(input, { target: { value: '56' } });
    const list = screen.getByRole('listbox');
    expect(list.querySelector('mark')).toHaveTextContent('56');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('dialog', { name: 'Sector Details' })).toBeInTheDocument();
    await screen.findByText('Active Sector: sector 56');
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close detail view' }));
    expect(input).not.toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Clear sector search' }));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  } finally { scroll.mockRestore(); }
});

test('tier filtering stays local and pagination replaces cards rather than growing the grid', async () => {
  fetch.mockImplementation((url) => url.includes('sector-rankings') ? json({ ...rankings, sectors: Array.from({ length: 14 }, (_, i) => ({ ...sectorRow, sector: `sector ${i + 1}` })) }) : response(url));
  const { container } = mount(); await screen.findByRole('heading', { name: 'Find your market position' });
  const grid = container.querySelector('.compact-sector-grid');
  expect(grid.children).toHaveLength(6);
  const requests = fetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Next sectors' }));
  expect(grid.children).toHaveLength(6);
  expect(screen.queryByRole('button', { name: 'View Sector Details for sector 1' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Affordable Entry', exact: true }));
  expect(screen.getByText('No sector reports match these filters.')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(requests);
});

test('property type scopes overview and on-demand reports; modal errors offer retry', async () => {
  mount(); await screen.findByRole('heading', { name: 'Find your market position' });
  fireEvent.change(screen.getByLabelText('Insights property type'), { target: { value: 'house' } });
  await screen.findByRole('heading', { name: 'Find your market position' });
  fetch.mockImplementation((url) => url.includes('valuation-alerts') ? json({ error: { message: 'Report unavailable' } }, 503) : response(url));
  fireEvent.click(screen.getByRole('button', { name: 'View Sector Details for sector 56' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Report unavailable');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('valuation-alerts?property_type=house&sector=sector+56'), expect.any(Object));
  fetch.mockImplementation(response);
  fireEvent.click(screen.getByRole('button', { name: 'Retry sector report' }));
  expect(await screen.findByText('Possession-age mix')).toBeInTheDocument();
});

test('changing locations inside a modal aborts stale requests and preserves the opening trigger', async () => {
  let resolveOld;
  fetch.mockImplementation((url) => url.includes('valuation-alerts?sector=sector+56') ? new Promise((resolve) => { resolveOld = resolve; }) : response(url));
  mount(); await screen.findByRole('heading', { name: 'Find your market position' });
  const trigger = screen.getByRole('button', { name: 'Buyer Advisory for sector 56' });
  fireEvent.click(trigger);
  const selector = await screen.findByLabelText('Buyer advisory sector');
  const old = fetch.mock.calls.find(([url]) => url.includes('valuation-alerts?sector=sector+56'));
  fireEvent.change(selector, { target: { value: 'sector 5' } });
  expect(old[1].signal.aborted).toBe(true);
  await screen.findByText('Verify the original listing and property documents.');
  resolveOld(await json({ ...alerts, buyer_checklist: ['Obsolete checklist'] }));
  await waitFor(() => expect(screen.queryByText('Obsolete checklist')).not.toBeInTheDocument());
  expect(screen.getByText('Active Sector: sector 5')).toBeInTheDocument();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Close detail view' }));
  expect(trigger).not.toHaveFocus();
});

test('brief and methodology controls open overlays without hash navigation or eager valuation requests', async () => {
  mount(); await screen.findByRole('heading', { name: 'Find your market position' });
  const hash = window.location.hash;
  fireEvent.click(screen.getByRole('button', { name: 'How tiers work' }));
  expect(screen.getByRole('dialog', { name: 'How market tiers work' })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Close detail view' }));
  fireEvent.click(screen.getByRole('button', { name: 'Explore sector 56' }));
  await screen.findByText('Possession-age mix');
  expect(window.location.hash).toBe(hash);
});

test('narrative failure remains isolated from sector reports and retry recovers', async () => {
  fetch.mockImplementation((url) => url.includes('summary-narratives') ? json({ error: { message: 'Brief unavailable' } }, 503) : response(url));
  mount(); expect(await screen.findByRole('alert')).toHaveTextContent('Brief unavailable');
  expect(screen.getByRole('button', { name: 'View Sector Details for sector 56' })).toBeInTheDocument();
  fetch.mockImplementation(response); fireEvent.click(screen.getByRole('button', { name: 'Retry insights' }));
  expect(await screen.findByRole('heading', { name: 'Your executive market brief' })).toBeInTheDocument();
});

test('external map requests open a sector report once and a new token reopens the same sector', async () => {
  const view = render(<InsightsDashboard notify={notify} onConnection={onConnection} sectorRequest={{ sector: 'sector 56', id: 1 }}/>);
  expect(await screen.findByRole('dialog', { name: 'Sector Details' })).toBeInTheDocument();
  expect(await screen.findByText('Possession-age mix')).toBeInTheDocument();
  expect(screen.getByLabelText('Buyer advisory sector')).toHaveValue('sector 56');
  fireEvent.click(screen.getByRole('button', { name: 'Close detail view' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.rerender(<InsightsDashboard notify={notify} onConnection={onConnection} sectorRequest={{ sector: 'sector 56', id: 1 }}/>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.rerender(<InsightsDashboard notify={notify} onConnection={onConnection} sectorRequest={{ sector: 'sector 56', id: 2 }}/>);
  expect(await screen.findByRole('dialog', { name: 'Sector Details' })).toBeInTheDocument();
  expect(await screen.findByText('Possession-age mix')).toBeInTheDocument();
});
