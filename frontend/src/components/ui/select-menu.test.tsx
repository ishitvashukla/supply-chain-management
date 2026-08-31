import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectMenu } from './select-menu';

const OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'ACH', label: 'ACH', description: 'Bank transfer' },
];

describe('SelectMenu', () => {
  it('shows the placeholder until something is chosen', () => {
    render(<SelectMenu value="" onChange={vi.fn()} options={OPTIONS} placeholder="Pick one…" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick one…');
  });

  it('shows the selected option, not its raw value', () => {
    render(<SelectMenu value="ACH" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('ACH');
  });

  it('reports the value, not the label, when an option is picked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SelectMenu value="" onChange={onChange} options={OPTIONS} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Card/ }));

    expect(onChange).toHaveBeenCalledWith('CARD');
  });

  it('offers a clear entry that selects the empty value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SelectMenu value="CASH" onChange={onChange} options={OPTIONS} clearLabel="All methods" />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('button', { name: 'All methods' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('cannot be opened when disabled', async () => {
    const user = userEvent.setup();
    render(<SelectMenu value="" onChange={vi.fn()} options={OPTIONS} disabled />);

    await user.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
