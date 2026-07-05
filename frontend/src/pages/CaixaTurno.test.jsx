import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaixaTurno from './CaixaTurno';

// Fluxo de DINHEIRO do turno: abrir com fundo, sangria e fechamento cego.
// A api é mockada; moeda/paraCentavos são os reais (é neles que mora o risco).

vi.mock('../components/AppShell', () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock('../ui/toast', () => ({
  notificar: { sucesso: vi.fn(), erro: vi.fn(), brasa: vi.fn(), info: vi.fn() },
}));
vi.mock('../lib/api', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    api: {
      caixa: { atual: vi.fn(), abrir: vi.fn(), movimento: vi.fn(), fechar: vi.fn() },
    },
  };
});

import { api } from '../lib/api';
import { notificar } from '../ui/toast';

const sessao = { usuario: { nome: 'Rico', papel: 'GERENTE' } };

const caixaAberto = {
  caixa: {
    id: 1,
    fundoAbertura: 10000,
    abertoPor: 'Rico (GERENTE)',
    abertoEm: '2026-07-05T20:00:00.000Z',
    movimentos: [],
  },
  resumo: {
    porForma: { dinheiro: { valor: 25000, lancamentos: 6 } },
    recebidoTotal: 25000,
    recebidoDinheiro: 25000,
    sangrias: 0,
    suprimentos: 0,
    esperadoDinheiro: 35000,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CaixaTurno — abrir caixa', () => {
  it('abre com o fundo digitado convertido para centavos', async () => {
    api.caixa.atual.mockResolvedValue({ caixa: null });
    api.caixa.abrir.mockResolvedValue({});

    render(<CaixaTurno sessao={sessao} aoSair={() => {}} />);
    await screen.findByText('Caixa fechado');

    // fundo padrão "100,00" -> troca para 150,00
    const campo = screen.getByDisplayValue('100,00');
    fireEvent.change(campo, { target: { value: '150,00' } });
    fireEvent.click(screen.getByRole('button', { name: /abrir caixa/i }));

    await waitFor(() => expect(api.caixa.abrir).toHaveBeenCalledWith(15000));
  });
});

describe('CaixaTurno — sangria e suprimento', () => {
  it('registra sangria em centavos com motivo', async () => {
    api.caixa.atual.mockResolvedValue(caixaAberto);
    api.caixa.movimento.mockResolvedValue({});

    render(<CaixaTurno sessao={sessao} aoSair={() => {}} />);
    await screen.findByText('Caixa aberto');

    fireEvent.change(screen.getByPlaceholderText('Valor (R$)'), { target: { value: '50,00' } });
    fireEvent.change(screen.getByPlaceholderText('Motivo'), { target: { value: 'troco pro banco' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() =>
      expect(api.caixa.movimento).toHaveBeenCalledWith({
        tipo: 'sangria',
        valor: 5000,
        motivo: 'troco pro banco',
      })
    );
  });

  it('recusa movimento sem motivo (não chama a api)', async () => {
    api.caixa.atual.mockResolvedValue(caixaAberto);

    render(<CaixaTurno sessao={sessao} aoSair={() => {}} />);
    await screen.findByText('Caixa aberto');

    fireEvent.change(screen.getByPlaceholderText('Valor (R$)'), { target: { value: '50,00' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar/i }));

    await waitFor(() => expect(notificar.erro).toHaveBeenCalled());
    expect(api.caixa.movimento).not.toHaveBeenCalled();
  });
});

describe('CaixaTurno — fechamento cego', () => {
  it('fecha com o valor contado e avisa a falta', async () => {
    api.caixa.atual
      .mockResolvedValueOnce(caixaAberto)
      .mockResolvedValue({ caixa: null }); // após fechar
    api.caixa.fechar.mockResolvedValue({
      resumo: { esperadoDinheiro: 35000, valorContado: 31000, diferenca: -4000 },
    });

    render(<CaixaTurno sessao={sessao} aoSair={() => {}} />);
    await screen.findByText('Caixa aberto');

    fireEvent.change(screen.getByPlaceholderText('Valor contado (R$)'), {
      target: { value: '310,00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /fechar caixa/i }));

    await waitFor(() =>
      expect(api.caixa.fechar).toHaveBeenCalledWith({ valorContado: 31000, observacao: undefined })
    );
    // falta na gaveta -> alerta de erro com o valor
    await waitFor(() => expect(notificar.erro).toHaveBeenCalled());
    // e o resumo do último fechamento mostra a diferença
    await screen.findByText('Ultimo fechamento');
    expect(screen.getByText('Faltou na gaveta')).toBeTruthy();
  });

  it('botão de fechar fica desabilitado sem contagem', async () => {
    api.caixa.atual.mockResolvedValue(caixaAberto);

    render(<CaixaTurno sessao={sessao} aoSair={() => {}} />);
    await screen.findByText('Caixa aberto');

    expect(screen.getByRole('button', { name: /fechar caixa/i }).disabled).toBe(true);
  });
});
