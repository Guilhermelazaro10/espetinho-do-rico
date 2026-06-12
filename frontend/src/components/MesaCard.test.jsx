import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MesaCard from './MesaCard';

describe('MesaCard — status visual das mesas', () => {
  it('mesa livre: rótulo neutro, sem total', () => {
    render(<MesaCard mesa={{ id: 1, numero: 1, status: 'livre' }} total={0} aoClicar={() => {}} />);

    expect(screen.getByText('Livre')).toBeTruthy();
    expect(screen.queryByText(/R\$/)).toBeNull();
  });

  it('mesa ocupada: borda brasa e total em reais (centavos formatados)', () => {
    const { container } = render(
      <MesaCard mesa={{ id: 2, numero: 2, status: 'ocupada' }} total={4800} aoClicar={() => {}} />
    );

    expect(screen.getByText('Ocupada')).toBeTruthy();
    expect(screen.getByText(/48,00/)).toBeTruthy();
    expect(container.querySelector('button').className).toContain('border-brasa');
  });

  it('mesa aguardando conta: borda vinho', () => {
    const { container } = render(
      <MesaCard mesa={{ id: 3, numero: 3, status: 'fechando' }} total={9600} aoClicar={() => {}} />
    );

    expect(screen.getByText('Aguardando conta')).toBeTruthy();
    expect(container.querySelector('button').className).toContain('border-rico-red');
  });

  it('clique aciona o callback', () => {
    const aoClicar = vi.fn();
    render(<MesaCard mesa={{ id: 1, numero: 1, status: 'livre' }} total={0} aoClicar={aoClicar} />);

    fireEvent.click(screen.getByRole('button'));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });
});
