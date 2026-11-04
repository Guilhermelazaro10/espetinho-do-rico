import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MesaCard from './MesaCard';

describe('MesaCard — status visual das mesas', () => {
  it('mesa livre: selo Livre, sem total', () => {
    render(<MesaCard mesa={{ id: 1, numero: 1, status: 'LIVRE' }} total={0} aoClicar={() => {}} />);

    expect(screen.getByText('Livre')).toBeTruthy();
    expect(screen.queryByText(/R\$/)).toBeNull();
  });

  it('mesa ocupada: fundo e borda vinho e total em reais (centavos formatados)', () => {
    const { container } = render(
      <MesaCard mesa={{ id: 2, numero: 2, status: 'OCUPADA' }} total={4800} aoClicar={() => {}} />
    );

    expect(screen.getByText('Ocupada')).toBeTruthy();
    expect(screen.getByText(/48,00/)).toBeTruthy();
    expect(container.querySelector('button').className).toContain('border-rico-red');
  });

  it('conta solicitada: selo curto "Conta", texto completo no title e no aria-label', () => {
    const { container } = render(
      <MesaCard mesa={{ id: 3, numero: 3, status: 'AGUARDANDO_PAGAMENTO' }} total={9600} aoClicar={() => {}} />
    );
    const botao = container.querySelector('button');

    expect(screen.getByText('Conta')).toBeTruthy();
    expect(botao.getAttribute('title')).toBe('Conta solicitada');
    expect(botao.getAttribute('aria-label')).toContain('Conta solicitada');
    expect(botao.className).toContain('border-atencao');
  });

  it('status legado "fechando" cai no estilo de conta', () => {
    render(<MesaCard mesa={{ id: 4, numero: 4, status: 'fechando' }} total={100} aoClicar={() => {}} />);
    expect(screen.getByText('Conta')).toBeTruthy();
  });

  it('mesma altura com ou sem consumo (faixas fixas)', () => {
    const { container: livre } = render(<MesaCard mesa={{ id: 5, numero: 5, status: 'LIVRE' }} total={0} aoClicar={() => {}} />);
    const { container: cheia } = render(
      <MesaCard mesa={{ id: 6, numero: 6, status: 'OCUPADA' }} total={2500} desde={new Date().toISOString()} aoClicar={() => {}} />
    );
    const altura = (c) => c.querySelector('button').className.match(/\bh-\[\d+px\]/)?.[0];
    expect(altura(livre)).toBe('h-[148px]');
    expect(altura(cheia)).toBe('h-[148px]');
  });

  it('mostra 10% quando a taxa de serviço está ativa', () => {
    render(<MesaCard mesa={{ id: 7, numero: 7, status: 'OCUPADA', taxaAtiva: true }} total={1000} aoClicar={() => {}} />);
    expect(screen.getByText('10%')).toBeTruthy();
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('taxa de serviço de 10%');
  });

  it('clique aciona o callback', () => {
    const aoClicar = vi.fn();
    render(<MesaCard mesa={{ id: 1, numero: 1, status: 'LIVRE' }} total={0} aoClicar={aoClicar} />);

    fireEvent.click(screen.getByRole('button'));
    expect(aoClicar).toHaveBeenCalledTimes(1);
  });
});
