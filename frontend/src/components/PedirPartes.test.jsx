import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MeusPedidos } from './PedirPartes';

vi.mock('../lib/api', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, api: { publico: { acompanhar: vi.fn() } } };
});

import { api } from '../lib/api';

const CODIGO = '3f2b8c1e-9d4a-4b6f-8e2a-1c5d7f9a0b3e';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Meus pedidos — acompanhamento por código', () => {
  it('acompanha pelo código e não pelo ID', async () => {
    api.publico.acompanhar.mockResolvedValue({ id: 42, status: 'em_preparo', tipo: 'DELIVERY', total: 2500 });
    render(
      <MeusPedidos
        lista={[{ id: 42, codigo: CODIGO, total: 2500, tipo: 'DELIVERY', criadoEm: Date.now() }]}
        onIrAoCardapio={() => {}}
      />
    );
    await waitFor(() => expect(api.publico.acompanhar).toHaveBeenCalledWith(CODIGO));
    expect(api.publico.acompanhar).toHaveBeenCalledTimes(1);
  });

  it('pedido antigo (sem código) aparece na lista, sem status ao vivo e sem erro', async () => {
    api.publico.acompanhar.mockResolvedValue({ id: 42, status: 'pendente', tipo: 'BALCAO', total: 1000 });
    render(
      <MeusPedidos
        lista={[
          { id: 42, codigo: CODIGO, total: 1000, tipo: 'BALCAO', criadoEm: Date.now() },
          { id: 7, total: 3300, tipo: 'DELIVERY', criadoEm: Date.now() - 86400000 },
        ]}
        onIrAoCardapio={() => {}}
      />
    );
    expect(screen.getByText('Pedido #7')).toBeTruthy();
    await waitFor(() => expect(api.publico.acompanhar).toHaveBeenCalledTimes(1));
    expect(api.publico.acompanhar).not.toHaveBeenCalledWith(undefined);
    expect(screen.getByText(/status indispon/i)).toBeTruthy();
  });
});
