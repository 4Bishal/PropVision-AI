import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import SectorSearch from '../components/SectorSearch';

function Search({ onSelect }) {
  const [value, setValue] = useState('');
  return <SectorSearch options={['sector 5', 'sector 54', 'dwarka expressway']} value={value} onChange={setValue} onSelect={onSelect}/>;
}

test('pointer suggestions preserve exact location labels and return the input as restoration target', () => {
  const choose = vi.fn(); render(<Search onSelect={choose}/>);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'DWARKA' } });
  expect(screen.getByRole('option').querySelector('mark')).toHaveTextContent('dwarka');
  fireEvent.click(screen.getByRole('option'));
  expect(choose).toHaveBeenCalledWith('dwarka expressway', input);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('arrow navigation, Escape, no-match and clear behaviors are bounded', () => {
  const choose = vi.fn(); render(<Search onSelect={choose}/>);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'sector' } });
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input).toHaveAttribute('aria-expanded', 'false');
  fireEvent.change(input, { target: { value: 'missing' } });
  expect(screen.getByRole('option')).toHaveAttribute('aria-disabled', 'true');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(choose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear sector search' }));
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
});
