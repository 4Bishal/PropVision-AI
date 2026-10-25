import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import ValuationResult from '../components/ValuationResult';
import ScrollToTop from '../components/common/ScrollToTop';
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
const result = { predicted_price_inr: 24500000, formatted_price: '₹2.45 Cr', valuation_range: { lower_bound: 22000000, upper_bound: 28000000, mae_pct: 19.48, q90_residual: 0.168705, confidence_level: '80% Empirical Prediction Interval' }, input: { sector: 'sector 5', built_up_area: 2000, bedRoom: 3, bathroom: 2 } };

test('minimal result uses saved statistics and calculated rate without speculative metrics', () => {
  render(<ValuationResult result={result}/>);
  expect(screen.getByText(/MAE: 19.5%/)).toBeInTheDocument();
  expect(screen.getByText(/12,250/)).toBeInTheDocument();
  expect(screen.getByText(/0.1687/)).toBeInTheDocument();
  expect(screen.getByText('2,000 sq.ft')).toBeInTheDocument();
  expect(screen.queryByText(/Monthly Rent|Demand Rating|input coverage/)).not.toBeInTheDocument();
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});

test('missing statistics are explicit and never replaced with a hardcoded band', () => {
  render(<ValuationResult result={{ ...result, valuation_range: null }}/>);
  expect(screen.getByText(/Statistical prediction interval unavailable/)).toBeInTheDocument();
  expect(screen.getByText('Unavailable')).toBeInTheDocument();
});

test('back-to-top appears only above 300px and respects reduced motion', async () => {
  const scrollTo = vi.fn(); vi.stubGlobal('scrollTo', scrollTo);
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  render(<ScrollToTop/>);
  expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 301 });
  fireEvent.scroll(window);
  fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 300 });
  fireEvent.scroll(window);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument());
});
