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

describe('Topo do cardápio — horário de fechamento', async () => {
  const { horaFechamento } = await import('./PedirPartes');
  it('extrai o fechamento do horário que o servidor manda', () => {
    expect(horaFechamento('Ter a Sáb, 17:00 às 02:00')).toBe('02:00');
    expect(horaFechamento('17:00 às 23:30')).toBe('23:30');
  });
  it('sem horário configurado não inventa', () => {
    expect(horaFechamento('')).toBeNull();
    expect(horaFechamento(undefined)).toBeNull();
  });
});

describe('Linha de produto — foco ao trocar + pelo controle de quantidade', async () => {
  const { useState } = await import('react');
  const { fireEvent } = await import('@testing-library/react');
  const { LinhaProduto } = await import('./PedirPartes');
  function Demo() {
    const [qtd, setQtd] = useState(0);
    return (
      <ul>
        <LinhaProduto
          produto={{ id: 1, nome: 'Carne', preco: 700 }}
          quantidade={qtd}
          aoAdicionar={() => setQtd((q) => q + 1)}
          aoRemover={() => setQtd((q) => q - 1)}
        />
      </ul>
    );
  }
  it('o foco vai para o novo + e volta para Adicionar ao tirar o último', () => {
    render(<Demo />);
    const adicionar = screen.getByRole('button', { name: 'Adicionar Carne' });
    adicionar.focus();
    fireEvent.click(adicionar);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mais um Carne' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tirar Carne da sacola' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Adicionar Carne' }));
  });
});
