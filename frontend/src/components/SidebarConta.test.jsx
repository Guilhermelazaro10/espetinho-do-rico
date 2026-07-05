import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SidebarConta from './SidebarConta';

// Fluxo de pagamento da mesa: quitar, dividir e parcial — em CENTAVOS exatos.

vi.mock('../ui/toast', () => ({
  notificar: { sucesso: vi.fn(), erro: vi.fn(), brasa: vi.fn(), info: vi.fn() },
}));
vi.mock('../lib/dialogos', () => ({
  confirmar: vi.fn().mockResolvedValue(true),
  pedirTexto: vi.fn(),
}));
vi.mock('../lib/api', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    api: {
      mesas: {
        conta: vi.fn(), pagar: vi.fn(), listar: vi.fn(), preConta: vi.fn(),
        definirTaxa: vi.fn(), atualizarStatus: vi.fn(), remover: vi.fn(),
        transferir: vi.fn(), transferirItem: vi.fn(),
      },
      pedidos: { cancelar: vi.fn(), removerItem: vi.fn(), imprimir: vi.fn() },
    },
  };
});

import { api } from '../lib/api';

const mesa = { id: 1, numero: 2, status: 'OCUPADA' };
const sessaoGerente = { usuario: { nome: 'Rico', papel: 'GERENTE' } };

const contaDe50 = {
  mesa: { id: 1, numero: 2, status: 'OCUPADA' },
  comandas: [
    {
      id: 7,
      criadoEm: '2026-07-05T20:00:00.000Z',
      criadoPor: 'Chico',
      itens: [
        { id: 1, quantidade: 5, precoUnitario: 1000, produto: { nome: 'Espetinho' }, observacao: null },
      ],
    },
  ],
  pagamentosParciais: [],
  subtotal: 5000,
  taxa: 0,
  taxaAtiva: false,
  totalDevido: 5000,
  pago: 0,
  saldoDevedor: 5000,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.mesas.conta.mockResolvedValue(contaDe50);
});

describe('SidebarConta — pagamento da mesa', () => {
  it('mostra quem lançou a comanda', async () => {
    render(<SidebarConta mesa={mesa} aoFechar={() => {}} aoAtualizar={() => {}} sessao={sessaoGerente} />);
    await screen.findByText(/Comanda #7/);
    expect(screen.getByText(/Chico/)).toBeTruthy();
  });

  it('escolher Dinheiro preenche o saldo e quita a conta em centavos', async () => {
    api.mesas.pagar.mockResolvedValue({ liberada: true, troco: 0 });

    render(<SidebarConta mesa={mesa} aoFechar={() => {}} aoAtualizar={() => {}} sessao={sessaoGerente} />);
    await screen.findByText(/Comanda #7/);

    fireEvent.click(screen.getByRole('button', { name: 'Dinheiro' }));
    // valor auto-preenchido com o saldo (50,00) -> botão vira "Quitar conta"
    const quitar = await screen.findByRole('button', { name: /quitar conta/i });
    fireEvent.click(quitar);

    await waitFor(() =>
      expect(api.mesas.pagar).toHaveBeenCalledWith(1, { forma: 'dinheiro', valor: 5000 })
    );
  });

  it('dividir por 2 preenche a metade e o botão vira pagamento parcial', async () => {
    api.mesas.pagar.mockResolvedValue({ liberada: false, valorAplicado: 2500, saldoDevedor: 2500 });

    render(<SidebarConta mesa={mesa} aoFechar={() => {}} aoAtualizar={() => {}} sessao={sessaoGerente} />);
    await screen.findByText(/Comanda #7/);

    fireEvent.click(screen.getByRole('button', { name: 'Pix' }));
    fireEvent.click(await screen.findByRole('button', { name: /÷2/ }));

    const parcial = await screen.findByRole('button', { name: /registrar pagamento parcial/i });
    fireEvent.click(parcial);

    await waitFor(() =>
      expect(api.mesas.pagar).toHaveBeenCalledWith(1, { forma: 'pix', valor: 2500 })
    );
  });

  it('pix acima do saldo é bloqueado (troco só em dinheiro)', async () => {
    render(<SidebarConta mesa={mesa} aoFechar={() => {}} aoAtualizar={() => {}} sessao={sessaoGerente} />);
    await screen.findByText(/Comanda #7/);

    fireEvent.click(screen.getByRole('button', { name: 'Pix' }));
    const campo = await screen.findByPlaceholderText('0,00');
    fireEvent.change(campo, { target: { value: '60,00' } });

    await screen.findByText(/troco só em dinheiro/i);
    const botao = screen.getByRole('button', { name: /quitar conta|registrar pagamento/i });
    expect(botao.disabled).toBe(true);
    expect(api.mesas.pagar).not.toHaveBeenCalled();
  });

  it('transferir mesa chama a api com a mesa de destino', async () => {
    api.mesas.listar.mockResolvedValue([
      { id: 1, numero: 2, status: 'OCUPADA' },
      { id: 3, numero: 4, status: 'LIVRE' },
    ]);
    api.mesas.transferir.mockResolvedValue({ origem: 2, destino: 4 });

    render(<SidebarConta mesa={mesa} aoFechar={() => {}} aoAtualizar={() => {}} sessao={sessaoGerente} />);
    await screen.findByText(/Comanda #7/);

    fireEvent.click(screen.getByRole('button', { name: /transferir mesa/i }));
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar transferência/i }));

    await waitFor(() => expect(api.mesas.transferir).toHaveBeenCalledWith(1, 3));
  });
});
