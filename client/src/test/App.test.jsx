import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import App from '../App';
import { predictionPayload } from '../api';

const dashboardProbe = vi.hoisted(() => ({ renders: vi.fn() }));
vi.mock('../components/Insights/InsightsDashboard', () => ({ default: ({ sectorRequest }) => <div>Dedicated market insights<input aria-label="Persistent insights control" defaultValue=""/>{sectorRequest && <output aria-label="Requested Insights sector">{sectorRequest.sector} · {sectorRequest.id}</output>}</div> }));
vi.mock('../components/Analytics/AnalyticsDashboard', () => ({ default: ({ onOpenSectorInsights }) => {
  dashboardProbe.renders();
  return <div>Market overview content<input aria-label="Persistent dashboard control" defaultValue=""/><button type="button" onClick={() => onOpenSectorInsights('sector 54')}>Map sector Insights</button></div>;
} }));

const categories = { sector: ['sector 5', 'sector 56'], property_type: ['flat', 'house'],
  balcony: ['0', '1', '3+'], agePossession: ['New Property', 'Old Property'],
  furnishing_type: ['unfurnished', 'furnished'], floor_category: ['Low-Rise', 'High-Rise'],
  luxury_category: ['Standard', 'Luxury'] };
const json = (data, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => data });
beforeEach(() => { window.history.replaceState({}, '', '/'); dashboardProbe.renders.mockClear(); localStorage.clear(); vi.stubGlobal('fetch', vi.fn((url) => url.endsWith('/health') ? json({ express: 'online', fastapi: 'online' }) : json({ categories }))); });
afterEach(() => vi.unstubAllGlobals());

async function ready() {
  render(<App/>);
  fireEvent.click(screen.getByRole('tab', { name: 'Price Predictor' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Calculate Valuation/ })).toBeEnabled());
}

function completePrediction() {
  for (const [field, values] of Object.entries(categories)) {
    const form = screen.getByRole('form', { name: 'House price predictor' });
    fireEvent.change(form.querySelector(`[name="${field}"]`), { target: { value: values[0] } });
  }
}

test('loads all seven category controls dynamically and shows connections', async () => {
  await ready();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/schema-options'), expect.any(Object));
  const form = screen.getByRole('form', { name: 'House price predictor' });
  for (const [field, values] of Object.entries(categories)) {
    expect([...form.querySelector(`[name="${field}"]`).options].slice(1).map((o) => o.value)).toEqual(values);
  }
  expect(screen.getByText('Express')).toHaveTextContent('online');
});

test('sends exact numeric prediction fields and displays result with submitted summary', async () => {
  await ready(); completePrediction();
  fetch.mockImplementation((url) => url.endsWith('/predict') ? json({ predicted_price_inr: 14200000,
    formatted_price: '₹1.42 Cr', log_prediction: 0.88 }) : json({ categories }));
  fireEvent.submit(screen.getByRole('form', { name: 'House price predictor' }));
  expect(await screen.findByText('₹1.42 Cr')).toBeInTheDocument();
  const call = fetch.mock.calls.find(([url]) => url.endsWith('/predict'));
  const body = JSON.parse(call[1].body);
  expect(Object.keys(body)).toHaveLength(12);
  expect(body).toMatchObject({ bedRoom: 3, bathroom: 2, built_up_area: 1500,
    'servant room': 0, 'store room': 0, balcony: '0', sector: 'sector 5' });
});

test('prediction loading disables submission until response', async () => {
  await ready(); completePrediction();
  let resolve;
  fetch.mockImplementation(() => new Promise((r) => { resolve = r; }));
  fireEvent.submit(screen.getByRole('form', { name: 'House price predictor' }));
  expect(screen.getByText('Calculating valuation...')).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'House price predictor' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit Parameters' })).toBeEnabled();
  resolve(await json({ predicted_price_inr: 1e7, formatted_price: '₹1 Cr' }));
  await screen.findByText('₹1.00 Cr');
});



test('network outage shows retry and disables forms; retry recovers', async () => {
  fetch.mockRejectedValue(new TypeError('network'));
  render(<App/>);
  fireEvent.click(screen.getByRole('tab', { name: 'Price Predictor' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the backend');
  expect(screen.getByRole('button', { name: /Calculate Valuation/ })).toBeDisabled();
  fetch.mockImplementation(() => json({ categories }));
  fireEvent.click(screen.getByRole('button', { name: /Retry connection/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Calculate Valuation/ })).toBeEnabled());
});

test('upstream downtime is distinct from Express connection failure', async () => {
  fetch.mockImplementation(() => json({ error: { code: 'ML_UNAVAILABLE', message: 'ML service is unavailable' } }, 503));
  render(<App/>);
  fireEvent.click(screen.getByRole('tab', { name: 'Price Predictor' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('ML service is unavailable');
  expect(screen.getByText('Express')).toHaveTextContent('online');
  expect(screen.getByText('ML engine')).toHaveTextContent('offline');
});

test('theme preference persists', async () => {
  await ready();
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('propvision-theme')).toBe('dark');
});

test('empty numeric controls cannot silently become zero', () => {
  expect(() => predictionPayload({ built_up_area: '' })).toThrow();
});

test('analytics is the default homepage and navigation reaches predictor and insights', async () => {
  render(<App/>);
  expect(screen.getByRole('tab', { name: 'GeoMap Analytics' })).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByText('Market overview content')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Price Predictor' }));
  expect(screen.getByRole('form', { name: 'House price predictor' })).toBeVisible();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Price Predictor' }), { key: 'ArrowRight' });
  fireEvent.keyDown(screen.getByRole('tab', { name: 'GeoMap Analytics' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Market Insights' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText('Recommendation Finder')).not.toBeInTheDocument();
});


test('theme toggles do not re-render or refetch the mounted dashboard', async () => {
  render(<App/>);
  await screen.findByText('Market overview content');
  const before = dashboardProbe.renders.mock.calls.length;
  const requests = fetch.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(dashboardProbe.renders).toHaveBeenCalledTimes(before);
  expect(fetch).toHaveBeenCalledTimes(requests);
});

test('navigation paints a skeleton immediately and preserves dashboard state across predictor visits', async () => {
  render(<App/>);
  expect(screen.getByRole('status', { name: 'Loading analytics workspace' })).toBeInTheDocument();
  await screen.findByText('Market overview content');
  fireEvent.change(screen.getByRole('textbox', { name: 'Persistent dashboard control' }), { target: { value: 'keep my selection' } });
  const renders = dashboardProbe.renders.mock.calls.length;
  fireEvent.click(screen.getByRole('tab', { name: 'Price Predictor' }));
  fireEvent.click(screen.getByRole('tab', { name: 'GeoMap Analytics' }));
  expect(screen.getByRole('status', { name: 'Loading analytics workspace' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Persistent dashboard control' })).toHaveValue('keep my selection'));
  expect(dashboardProbe.renders).toHaveBeenCalledTimes(renders);
  fireEvent.click(screen.getByRole('tab', { name: 'Market Insights' }));
  expect(screen.getByRole('status', { name: 'Loading market insights' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('tabpanel', { name: 'Market Insights' })).toHaveAttribute('aria-hidden', 'false'));
  expect(await screen.findByText('Dedicated market insights')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Persistent dashboard control', hidden: true })).toHaveValue('keep my selection');
});

test('rapid tab changes cancel obsolete visual initialization', async () => {
  render(<App/>);
  fireEvent.click(screen.getByRole('tab', { name: 'Market Insights' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Price Predictor' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Calculate Valuation/ })).toBeEnabled());
  expect(screen.getByRole('tab', { name: 'Price Predictor' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: 'Price Predictor' })).toHaveAttribute('aria-hidden', 'false');
  fireEvent.click(screen.getByRole('tab', { name: 'Market Insights' }));
  await waitFor(() => expect(screen.getByRole('tabpanel', { name: 'Market Insights' })).toHaveAttribute('aria-hidden', 'false'));
});

test('map handoff switches tabs and carries repeated exact-sector requests', async () => {
  render(<App/>); await screen.findByText('Market overview content');
  fireEvent.click(screen.getByRole('button', { name: 'Map sector Insights' }));
  expect(screen.getByRole('tab', { name: 'Market Insights' })).toHaveAttribute('aria-selected', 'true');
  expect(await screen.findByLabelText('Requested Insights sector')).toHaveTextContent('sector 54 · 1');
  fireEvent.click(screen.getByRole('tab', { name: 'GeoMap Analytics' }));
  await screen.findByRole('button', { name: 'Map sector Insights' });
  fireEvent.click(screen.getByRole('button', { name: 'Map sector Insights' }));
  await waitFor(() => expect(screen.getByLabelText('Requested Insights sector')).toHaveTextContent('sector 54 · 2'));
});

test('focus mode preserves inputs when editing and recalculating', async () => {
  await ready(); completePrediction();
  fetch.mockImplementation((url) => url.endsWith('/predict') ? json({ predicted_price_inr: 14200000,
    formatted_price: 'INR 1.42 Cr' }) : url.includes('/recommend/') ? json([]) : json({ categories }));
  fireEvent.submit(screen.getByRole('form', { name: 'House price predictor' }));
  await screen.findByRole('region', { name: 'Property valuation result' });
  expect(screen.queryByRole('form', { name: 'House price predictor' })).not.toBeInTheDocument();
  expect(screen.getByText(/3 BHK, sector 5, 1,500 sq.ft/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Parameters' }));
  const form = screen.getByRole('form', { name: 'House price predictor' });
  expect(form.querySelector('[name="sector"]')).toHaveValue('sector 5');
  fireEvent.change(form.querySelector('[name="built_up_area"]'), { target: { value: '2100' } });
  fireEvent.submit(form);
  await screen.findByRole('region', { name: 'Property valuation result' });
  expect(screen.getByText(/3 BHK, sector 5, 2,100 sq.ft/)).toBeInTheDocument();
});

test('brand navigation opens the predictor URL and direct routes survive reload', async () => {
  window.history.replaceState({}, '', '/predictor');
  render(<App/>);
  expect(screen.getByRole('tab', { name: 'Price Predictor' })).toHaveAttribute('aria-selected', 'true');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Calculate Valuation' })).toBeEnabled());
  fireEvent.click(screen.getByRole('tab', { name: 'GeoMap Analytics' }));
  expect(window.location.pathname).toBe('/analytics');
  fireEvent.click(screen.getByRole('link', { name: 'PropVision AI home' }));
  expect(window.location.pathname).toBe('/predictor');
  expect(screen.getByRole('form', { name: 'House price predictor' })).toBeVisible();
});

test('install prompt is actionable once and safely settles after dismissal', async () => {
  await ready();
  expect(screen.queryByRole('button', { name: 'Install PropVision AI App' })).not.toBeInTheDocument();
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn().mockResolvedValue(undefined);
  fireEvent(window, event);
  fireEvent.click(screen.getByRole('button', { name: 'Install PropVision AI App' }));
  await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: 'Install PropVision AI App' })).not.toBeInTheDocument();
});

test('PNG branding follows the floating theme switcher', async () => {
  await ready();
  const logo = screen.getByRole('link', { name: 'PropVision AI home' }).querySelector('img');
  expect(logo).toHaveAttribute('src', '/assets/logo.png');
  fireEvent.click(screen.getByTestId('theme-toggle'));
  expect(logo).toHaveAttribute('src', '/assets/logo-dark.png');
  expect(screen.getByTestId('theme-toggle').parentElement).toBe(document.body);
});
