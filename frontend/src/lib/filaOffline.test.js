import { describe, it, expect, beforeEach, vi } from 'vitest';
import { adicionarNaFila, listarFila, removerDaFila, sincronizarFila } from './filaOffline';

beforeEach(() => localStorage.clear());

const pedido = { mesaId: 3, itens: [{ produtoId: 1, quantidade: 2 }] };

describe('fila offline de pedidos', () => {
  it('adiciona e lista pedidos pendentes', () => {
    adicionarNaFila(pedido);
    adicionarNaFila({ ...pedido, mesaId: 5 });

    const fila = listarFila();
    expect(fila).toHaveLength(2);
    expect(fila[0].mesaId).toBe(3);
    expect(fila[0].chave).toBeTruthy();
  });

  it('remove por chave', () => {
    const item = adicionarNaFila(pedido);
    removerDaFila(item.chave);
    expect(listarFila()).toHaveLength(0);
  });

  it('sincroniza: envia tudo quando a rede volta', async () => {
    adicionarNaFila(pedido);
    adicionarNaFila({ ...pedido, mesaId: 5 });
    const enviar = vi.fn().mockResolvedValue({});

    const resultado = await sincronizarFila(enviar);

    expect(enviar).toHaveBeenCalledTimes(2);
    expect(resultado).toEqual({ enviados: 2, descartados: 0, restantes: 0 });
  });

  it('preserva a fila se a rede ainda está fora', async () => {
    adicionarNaFila(pedido);
    const erroRede = Object.assign(new Error('sem rede'), { offline: true });
    const enviar = vi.fn().mockRejectedValue(erroRede);

    const resultado = await sincronizarFila(enviar);

    expect(resultado.restantes).toBe(1);
    expect(listarFila()).toHaveLength(1);
  });

  it('descarta pedido rejeitado pelo servidor (não insiste para sempre)', async () => {
    adicionarNaFila(pedido);
    const erroValidacao = new Error('Mesa não encontrada'); // sem flag offline
    const enviar = vi.fn().mockRejectedValue(erroValidacao);

    const resultado = await sincronizarFila(enviar);

    expect(resultado).toEqual({ enviados: 0, descartados: 1, restantes: 0 });
  });
});
