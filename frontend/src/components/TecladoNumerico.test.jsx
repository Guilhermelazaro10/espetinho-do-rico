import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TecladoNumerico from './TecladoNumerico';

describe('TecladoNumerico', () => {
  it('renderiza as teclas e dispara os callbacks certos', () => {
    const aoDigitar = vi.fn();
    const aoApagar = vi.fn();
    const aoLimpar = vi.fn();
    render(<TecladoNumerico aoDigitar={aoDigitar} aoApagar={aoApagar} aoLimpar={aoLimpar} />);

    fireEvent.click(screen.getByRole('button', { name: '7' }));
    expect(aoDigitar).toHaveBeenCalledWith('7');

    fireEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(aoApagar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(aoLimpar).toHaveBeenCalledTimes(1);
  });
});
