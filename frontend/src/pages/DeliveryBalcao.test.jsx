import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeliveryBalcao from './DeliveryBalcao';

// Venda rápida (só itens + pagamento) e pausa do delivery.
// A api é mockada; moeda/paraCentavos são os reais (é neles que mora o troco).

vi.mock('../components/AppShell', () => ({
  default: ({ children, acoes }) => <div>{acoes}{children}</div>,
}));
vi.mock('../ui/toast', () => ({
  notificar: { sucesso: vi.fn(), erro: vi.fn(), brasa: vi.fn(), info: vi.fn() },
}));
vi.mock('../hooks/useAtualizacaoAoVivo', () => ({ useAtualizacaoAoVivo: () => {} }));
vi.mock('../lib/dialogos', () => ({ confirmar: vi.fn(), pedirTexto: vi.fn() }));
vi.mock('../lib/api', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    api: {
      produtos: { listar: vi.fn() },
      pedidos: { listarAbertos: vi.fn(), listarPendentes: vi.fn(), vendaRapida: vi.fn(), criar: vi.fn() },
      publico: { cardapio: vi.fn() },
      loja: { definirDelivery: vi.fn() },
    },
  };
});

import { api } from '../lib/api';
import { notificar } from '../ui/toast';
import { confirmar } from '../lib/dialogos';

const gerente = { usuario: { nome: 'Rico', papel: 'GERENTE' } };
const garcom = { usuario: { nome: 'Zé', papel: 'GARCOM' } };

beforeEach(() => {
  vi.clearAllMocks();
  api.produtos.listar.mockResolvedValue([
    { id: 1, nome: 'Espeto de Carne', preco: 1200, categoria: 'Espetinhos' },
  ]);
  api.pedidos.listarAbertos.mockResolvedValue([]);
  api.pedidos.listarPendentes.mockResolvedValue([]);
  api.publico.cardapio.mockResolvedValue({ loja: { bairros: [], delivery: true } });
});

describe('Venda rápida', () => {
  it('vende só com itens + dinheiro e mostra o troco', async () => {
    api.pedidos.vendaRapida.mockResolvedValue({ id: 77, total: 2400, troco: 2600 });
    render(<DeliveryBalcao sessao={gerente} aoSair={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /venda rápida/i }));
    expect(screen.queryByText('Cliente')).toBeNull(); // sem cadastro

    const produto = await screen.findByText('Espeto de Carne');
    fireEvent.click(produto);
    fireEvent.click(produto);
    fireEvent.click(screen.getByRole('button', { name: /dinheiro/i }));
    fireEvent.change(screen.getByLabelText(/valor recebido/i), { target: { value: '50' } });

    expect(screen.getAllByText(/26,00/).length).toBeGreaterThan(0); // troco na tela
    fireEvent.click(screen.getByRole('button', { name: /receber/i }));

    await waitFor(() => expect(api.pedidos.vendaRapida).toHaveBeenCalled());
    expect(api.pedidos.vendaRapida.mock.calls[0][0]).toMatchObject({
      formaPagamento: 'dinheiro',
      valorRecebido: 5000,
      entregueNaHora: false,
      itens: [{ produtoId: 1, quantidade: 2 }],
    });
    expect(notificar.sucesso).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/TROCO/));
  });

  it('não envia sem forma de pagamento', async () => {
    render(<DeliveryBalcao sessao={gerente} aoSair={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /venda rápida/i }));
    fireEvent.click(await screen.findByText('Espeto de Carne'));
    fireEvent.click(screen.getByRole('button', { name: /receber/i }));
    expect(api.pedidos.vendaRapida).not.toHaveBeenCalled();
    expect(notificar.erro).toHaveBeenCalled();
  });

  it('garçom não vê a venda rápida nem o botão de pausar', async () => {
    render(<DeliveryBalcao sessao={garcom} aoSair={() => {}} />);
    await screen.findByText('Espeto de Carne');
    expect(screen.queryByRole('button', { name: /venda rápida/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /pausar delivery/i })).toBeNull();
  });
});

describe('Pausar delivery', () => {
  it('pede confirmação e pausa', async () => {
    confirmar.mockResolvedValue(true);
    api.loja.definirDelivery.mockResolvedValue({ deliveryAtivo: false });
    render(<DeliveryBalcao sessao={gerente} aoSair={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /pausar delivery/i }));
    await waitFor(() => expect(api.loja.definirDelivery).toHaveBeenCalledWith(false));
    expect(await screen.findByText(/delivery pausado\./i)).toBeTruthy();
  });

  it('desistir na confirmação não pausa', async () => {
    confirmar.mockResolvedValue(false);
    render(<DeliveryBalcao sessao={gerente} aoSair={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /pausar delivery/i }));
    await waitFor(() => expect(confirmar).toHaveBeenCalled());
    expect(api.loja.definirDelivery).not.toHaveBeenCalled();
  });
});

describe('Em andamento no segmentado', () => {
  it('mostra a contagem e, ao escolher, lista os pedidos abertos', async () => {
    api.pedidos.listarAbertos.mockImplementation(async (tipo) =>
      tipo === 'DELIVERY'
        ? [{ id: 9, tipo: 'DELIVERY', status: 'aberto', total: 3100, clienteNome: 'Ana', criadoEm: new Date().toISOString(), itens: [] }]
        : []
    );
    render(<DeliveryBalcao sessao={gerente} aoSair={() => {}} />);
    const opcao = await screen.findByRole('button', { name: /em andamento/i });
    await waitFor(() => expect(opcao.textContent).toContain('1'));
    expect(await screen.findByText('Espeto de Carne')).toBeTruthy();
    fireEvent.click(opcao);
    // Os produtos dão lugar à fila (a coluna de 1536px+ também existe no DOM do jsdom)
    await waitFor(() => expect(screen.queryByText('Espeto de Carne')).toBeNull());
    expect(screen.getAllByText('#9').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ana').length).toBeGreaterThan(0);
  });
});

describe('Fila de Delivery/Balcão', () => {
  it('pede só DELIVERY e BALCAO e nunca mostra pedido de mesa', async () => {
    api.pedidos.listarAbertos.mockImplementation(async (tipo) =>
      tipo === 'BALCAO'
        ? [
            { id: 21, tipo: 'BALCAO', status: 'aberto', total: 900, clienteNome: 'Balcão Ok', criadoEm: new Date().toISOString(), itens: [] },
            // Se a API um dia devolver mesa por engano, a tela não mostra
            { id: 22, tipo: 'MESA', status: 'aberto', total: 900, clienteNome: 'Mesa Intrusa', criadoEm: new Date().toISOString(), itens: [] },
          ]
        : []
    );
    render(<DeliveryBalcao sessao={gerente} aoSair={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /em andamento/i }));
    expect((await screen.findAllByText('Balcão Ok')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Mesa Intrusa')).toBeNull();
    const tiposPedidos = api.pedidos.listarAbertos.mock.calls.map((c) => c[0]);
    expect(new Set(tiposPedidos)).toEqual(new Set(['DELIVERY', 'BALCAO']));
  });
});
