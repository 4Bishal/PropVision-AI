import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import DeferredPanel from '../components/Analytics/DeferredPanel';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('visuals wait for viewport proximity and a painted fallback', () => {
  vi.useFakeTimers();
  let observerCallback;
  const disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() { disconnect(); }
  });
  render(<DeferredPanel label="Loading test chart"><div>Heavy chart initialized</div></DeferredPanel>);
  expect(screen.getByRole('status', { name: 'Loading test chart' })).toBeInTheDocument();
  expect(screen.queryByText('Heavy chart initialized')).not.toBeInTheDocument();
  act(() => vi.runAllTimers());
  expect(screen.queryByText('Heavy chart initialized')).not.toBeInTheDocument();
  act(() => observerCallback([{ isIntersecting: true }]));
  expect(screen.queryByText('Heavy chart initialized')).not.toBeInTheDocument();
  act(() => vi.runAllTimers());
  expect(screen.getByText('Heavy chart initialized')).toBeInTheDocument();
  expect(disconnect).toHaveBeenCalled();
});

test('scheduled visual work is cancelled if the panel unmounts', () => {
  vi.useFakeTimers();
  vi.stubGlobal('IntersectionObserver', undefined);
  const rendered = vi.fn();
  function Chart() { rendered(); return <div>Chart</div>; }
  const view = render(<DeferredPanel><Chart/></DeferredPanel>);
  view.unmount();
  act(() => vi.runAllTimers());
  expect(rendered).not.toHaveBeenCalled();
});
