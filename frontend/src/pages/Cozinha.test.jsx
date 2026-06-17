import { describe, it, expect } from 'vitest';
import { tituloPedido } from './Cozinha';

// Trava o bug corrigido: delivery/balcão não têm mesa e não podem quebrar a cozinha.
describe('tituloPedido — rótulo do ticket por canal', () => {
  it('mesa usa o número formatado', () => {
    expect(tituloPedido({ tipo: 'MESA', mesa: { numero: 3 } })).toBe('Mesa 03');
  });

  it('mesa cai no mesaId quando a relação não veio', () => {
    expect(tituloPedido({ tipo: 'MESA', mesaId: 7 })).toBe('Mesa 07');
  });

  it('delivery com mesa null NÃO quebra e mostra o cliente', () => {
    expect(tituloPedido({ tipo: 'DELIVERY', mesa: null, clienteNome: 'Ana' })).toBe('Delivery · Ana');
  });

  it('balcão sem cliente', () => {
    expect(tituloPedido({ tipo: 'BALCAO', mesa: null })).toBe('Balcão');
  });
});
