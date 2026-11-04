import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Cozinha from './Cozinha';

// A chapa trabalha por ordem de chegada: o pedido mais antigo vem primeiro.
// A API devolve do mais novo para o mais antigo (criadoEm desc), então a tela
// precisa reordenar cada coluna.
vi.mock('../ui/toast', () => ({
  notificar: { sucesso: vi.fn(), erro: vi.fn(), brasa: vi.fn() },
  ToasterGlobal: () => null,
}));
vi.mock('../hooks/useAtualizacaoAoVivo', () => ({ useAtualizacaoAoVivo: () => {} }));
vi.mock('../lib/api', () => ({
  api: { pedidos: { listarAbertos: vi.fn(), atualizarStatus: vi.fn() } },
}));

import { api } from '../lib/api';

const minAtras = (m) => new Date(Date.now() - m * 60_000).toISOString();
const pedido = (id, status, minutos, cliente) => ({
  id, status, tipo: 'BALCAO', clienteNome: cliente, mesa: null, criadoEm: minAtras(minutos),
  itens: [{ id: id * 10, quantidade: 1, produto: { nome: 'Carne' } }],
});

describe('Cozinha — ordem das colunas', () => {
  it('mostra do mais antigo para o mais novo em cada coluna', async () => {
    // Como a API manda hoje: mais novo primeiro
    api.pedidos.listarAbertos.mockResolvedValue([
      pedido(30, 'aberto', 1, 'Novo'),
      pedido(20, 'em_preparo', 5, 'Chapa nova'),
      pedido(10, 'aberto', 40, 'Antigo'),
      pedido(15, 'em_preparo', 25, 'Chapa antiga'),
      pedido(25, 'aberto', 12, 'Meio'),
    ]);
    render(<Cozinha />);

    const fila = (await screen.findByRole('heading', { name: /Na fila/ })).closest('section');
    const chapa = screen.getByRole('heading', { name: /Na chapa/ }).closest('section');
    const titulos = (secao) =>
      [...within(secao).getAllByText(/^Balcão · /)].map((el) => el.textContent.replace('Balcão · ', ''));

    expect(titulos(fila)).toEqual(['Antigo', 'Meio', 'Novo']);
    expect(titulos(chapa)).toEqual(['Chapa antiga', 'Chapa nova']);
  });
});

describe('Cozinha — venda rápida', () => {
  it('pedido pago antecipado mostra o selo "Pago · venda rápida"', async () => {
    api.pedidos.listarAbertos.mockResolvedValue([
      { ...pedido(40, 'aberto', 2, 'Balcão pago'), pagoAntecipado: true },
      pedido(41, 'aberto', 1, 'A pagar'),
    ]);
    render(<Cozinha />);
    expect(await screen.findByText('Pago · venda rápida')).toBeTruthy();
    expect(screen.getAllByText('Pago · venda rápida')).toHaveLength(1);
  });
});
