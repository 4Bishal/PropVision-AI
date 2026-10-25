import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { useState } from 'react';
import DetailModal from '../components/DetailModal';
import { lockBodyScroll } from '../components/bodyScrollLock';
import SectorOverviewMatches from '../components/Analytics/SectorOverviewMatches';

function ModalExample() {
  const [open, setOpen] = useState(true);
  return open && <DetailModal title="Sector details" onClose={() => setOpen(false)}>Sector overview</DetailModal>;
}
for (const method of ['Escape', 'backdrop', 'Close']) {
  test(`${method} releases body overflow and padding`, () => {
    document.body.style.paddingRight = '12px';
    render(<ModalExample/>);
    expect(document.body.style.overflow).toBe('hidden');
    const dialog = screen.getByRole('dialog');
    if (method === 'Escape') fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
    else if (method === 'backdrop') fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    else fireEvent.click(within(dialog).getByRole('button', { name: 'Close detail view' }));
    expect(document.body.style.overflow).toBe('unset');
    expect(document.body.style.paddingRight).toBe('0px');
  });
}
test('nested locks release safely even if the parent closes first', () => {
  const parent = lockBodyScroll(); const child = lockBodyScroll();
  parent(); expect(document.body.style.overflow).toBe('hidden');
  child(); expect(document.body.style.overflow).toBe('unset');
  parent(); expect(document.body.style.overflow).toBe('unset');
});
test('unmounting an open modal restores scrolling', () => {
  const { unmount } = render(<ModalExample/>);
  unmount(); expect(document.body.style.overflow).toBe('unset');
});
test('sector overview tabs expose compact metrics and support keyboard navigation', () => {
  render(<SectorOverviewMatches sector="sector 5" row={{ listing_count: 15, median_price_cr: 2, avg_price_per_sqft_inr: 10000 }}/>);
  expect(screen.getByRole('tabpanel')).toHaveTextContent('15');
  const overview = screen.getByRole('tab', { name: 'Sector & Property Analytics' });
  fireEvent.keyDown(overview, { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Recommended Market Alternatives' })).toHaveAttribute('aria-selected', 'true');
});
