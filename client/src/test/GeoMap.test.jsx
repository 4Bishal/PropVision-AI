import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { divIcon } from 'leaflet';
import GeoMap from '../components/Analytics/GeoMap';

const probe = vi.hoisted(() => ({ handlers: {}, center: { lat: 28.4595, lng: 77.0266 }, zoom: 11,
  tooltipLayer: { getTooltip: () => true, closeTooltip: vi.fn() },
  map: { invalidateSize: vi.fn(), stop: vi.fn(), closePopup: vi.fn(), eachLayer: vi.fn(), flyTo: vi.fn() } }));
vi.mock('leaflet', () => ({ divIcon: vi.fn((options) => options),
  DomEvent: { disableClickPropagation: vi.fn(), disableScrollPropagation: vi.fn(), off: vi.fn() } }));
vi.mock('react-leaflet', () => {
  const map = { ...probe.map, getCenter: () => probe.center, getZoom: () => probe.zoom };
  return { MapContainer: ({ children }) => <div>{children}</div>,
    Marker: ({ position, title, children, eventHandlers, zIndexOffset }) => <div data-testid="sector-marker" title={title} data-position={position.join(',')}
      data-z-index={zIndexOffset} onClick={eventHandlers.click}>{children}</div>,
    Popup: ({ children }) => <div>{children}</div>, Tooltip: ({ children }) => <div>{children}</div>,
    TileLayer: () => null, useMap: () => map, useMapEvents: (handlers) => { probe.handlers = handlers; return map; } };
});
beforeEach(() => { vi.clearAllMocks(); probe.center = { lat: 28.4595, lng: 77.0266 }; probe.zoom = 11;
  probe.map.eachLayer.mockImplementation((callback) => { callback(probe.tooltipLayer); callback({}); }); });

function point(sector, latitude = 28.45, longitude = 77.02) {
  return { sector, latitude, longitude, resolution: 'sector_polygon', median_price_cr: 1.2345,
    avg_price_cr: 1.3, avg_price_per_sqft_inr: 10000, listing_count: 15, price_variance_cr2: .25,
    source_url: 'https://www.openstreetmap.org/' };
}

test('renders all 115 custom markers with exact dataset medians', () => {
  render(<GeoMap data={{ sectors: Array.from({ length: 115 }, (_, i) => point(`sector ${i + 1}`, 28.4 + i / 10000)),
    unmapped_sectors: [], unresolved_location_labels: [] }} onOpenSectorInsights={vi.fn()}/>);
  expect(screen.getAllByTestId('sector-marker')).toHaveLength(115);
  expect(screen.getByTitle('sector 1: median ₹1.2345 Cr')).toBeInTheDocument();
  expect(divIcon.mock.calls.some(([options]) => options.html.includes('₹1.2345'))).toBe(true);
});

test('shared markers keep geographic coordinates and ambiguous labels are disclosed', () => {
  divIcon.mockClear();
  render(<GeoMap data={{ sectors: [point('sector 3'), point('sector 3 phase 2'),
    { ...point('new', 28.4595, 77.0266), resolution: 'city_fallback', location_note: 'Unresolved location.' }],
    unmapped_sectors: [], unresolved_location_labels: ['new'] }} onOpenSectorInsights={vi.fn()}/>);
  const markers = screen.getAllByTestId('sector-marker');
  expect(markers[0].dataset.position).toBe(markers[1].dataset.position);
  expect(divIcon.mock.calls[0][0].iconAnchor).not.toEqual(divIcon.mock.calls[1][0].iconAnchor);
  expect(screen.getByRole('status')).toHaveTextContent('actual location remains unresolved');
});

test('modal action closes map overlays and forwards the exact sector to Insights', () => {
  const open = vi.fn();
  render(<GeoMap data={{ sectors: [point('sector 54')], unmapped_sectors: [] }} onOpenSectorInsights={open}/>);
  expect(screen.queryByRole('button', { name: /Explore this sector/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId('sector-marker'));
  fireEvent.click(screen.getByRole('button', { name: /View Sector Insights/ }));
  expect(open).toHaveBeenCalledWith('sector 54');
  expect(probe.map.closePopup).toHaveBeenCalled();
  expect(probe.tooltipLayer.closeTooltip).toHaveBeenCalled();
});

test('pin selection reveals reset and resets center/zoom without remounting markers', () => {
  render(<GeoMap data={{ sectors: [point('sector 54')], unmapped_sectors: [] }} onOpenSectorInsights={vi.fn()}/>);
  expect(screen.queryByRole('button', { name: 'Reset map view to Gurgaon' })).not.toBeInTheDocument();
  const marker = screen.getByTestId('sector-marker');
  fireEvent.click(marker);
  expect(marker).toHaveAttribute('data-z-index', '1000');
  fireEvent.click(screen.getByRole('button', { name: 'Reset map view to Gurgaon' }));
  expect(probe.map.stop).toHaveBeenCalled();
  expect(probe.map.flyTo).toHaveBeenCalledWith([28.4595, 77.0266], 11, { animate: true, duration: .65 });
  expect(screen.getByTestId('sector-marker')).toBe(marker);
  expect(marker).toHaveAttribute('data-z-index', '0');
  expect(screen.queryByRole('button', { name: 'Reset map view to Gurgaon' })).not.toBeInTheDocument();
});

test('pan/zoom events reveal reset and reduced motion disables flight animation', () => {
  render(<GeoMap data={{ sectors: [point('sector 54')], unmapped_sectors: [] }} onOpenSectorInsights={vi.fn()}/>);
  probe.center = { lat: 28.5, lng: 77.1 }; probe.zoom = 14;
  act(() => probe.handlers.moveend());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Reset map view to Gurgaon' }));
    expect(probe.map.flyTo).toHaveBeenCalledWith([28.4595, 77.0266], 11, { animate: false, duration: .65 });
  } finally { vi.unstubAllGlobals(); }
});

for (const exit of ['Escape', 'Close', 'backdrop']) {
  test(`${exit} removes the complete selected-sector surface and map highlights`, () => {
    render(<GeoMap data={{ sectors: [{ ...point('new'), location_note: "Location 'new' is unresolved." }], unmapped_sectors: [] }} onOpenSectorInsights={vi.fn()}/>);
    const marker = screen.getByTestId('sector-marker');
    fireEvent.click(marker);
    const dialog = screen.getByRole('dialog', { name: 'Sector property details' });
    expect(screen.getByText("Location 'new' is unresolved.")).toBeInTheDocument();
    if (exit === 'Escape') fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
    else if (exit === 'backdrop') fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    else fireEvent.click(screen.getByRole('button', { name: 'Close detail view' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText("Location 'new' is unresolved.")).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sector reference source/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Sector Insights/ })).not.toBeInTheDocument();
    expect(marker).toHaveAttribute('data-z-index', '0');
    expect(probe.map.closePopup).toHaveBeenCalled();
    expect(probe.tooltipLayer.closeTooltip).toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('unset');
    fireEvent.click(marker);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
}

test('filtering away a selected sector unmounts its details and clears overlays', () => {
  const { rerender } = render(<GeoMap data={{ sectors: [point('new')], unmapped_sectors: [] }} onOpenSectorInsights={vi.fn()}/>);
  fireEvent.click(screen.getByTestId('sector-marker'));
  rerender(<GeoMap data={{ sectors: [point('sector 54')], unmapped_sectors: [] }} onOpenSectorInsights={vi.fn()}/>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /View Sector Insights/ })).not.toBeInTheDocument();
  expect(probe.map.closePopup).toHaveBeenCalled();
  expect(document.body.style.overflow).toBe('unset');
});
