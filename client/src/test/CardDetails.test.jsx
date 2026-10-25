import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CardDetailButton, CardDetailsProvider } from '../components/Analytics/CardDetails';

function Cards() {
  return <CardDetailsProvider><div data-testid="card-grid" className="intelligence-grid">
    {['floor', 'balcony'].map((id) => <article key={id} data-testid={id}><h3>{id}</h3>
      <CardDetailButton cardId={id} title={id}><p>{id} statistics</p></CardDetailButton>
    </article>)}
  </div></CardDetailsProvider>;
}

test('details use one full-width portal without changing sibling grid cards', async () => {
  render(<Cards/>);
  const grid = screen.getByTestId('card-grid');
  const siblings = [...grid.children];
  const floor = screen.getByRole('button', { name: 'View Detail: floor' });
  floor.focus(); fireEvent.click(floor);
  const dialog = screen.getByRole('dialog', { name: 'floor' });
  expect(dialog.parentElement).toBe(document.body);
  expect(dialog).toHaveClass('max-w-4xl', 'w-full');
  expect(floor).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'View Detail: balcony' })).toHaveAttribute('aria-expanded', 'false');
  expect(await within(dialog).findByText('floor statistics')).toBeInTheDocument();
  expect([...grid.children]).toEqual(siblings);
  expect(grid.querySelector('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close detail view' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(floor).not.toHaveFocus();
  expect(document.body.style.overflow).toBe('unset');

  fireEvent.click(screen.getByRole('button', { name: 'View Detail: balcony' }));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(await screen.findByText('balcony statistics')).toBeInTheDocument();
  expect(screen.queryByText('floor statistics')).not.toBeInTheDocument();
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toBe(document.body);
  // Explicit dismissal clears focus, but controls remain keyboard-focusable.
  floor.focus();
  expect(floor).toHaveFocus();
});

test('backdrop click dismisses the active detail', () => {
  render(<Cards/>);
  fireEvent.click(screen.getByRole('button', { name: 'View Detail: floor' }));
  fireEvent.click(screen.getByRole('dialog'), { clientX: -1, clientY: -1 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
