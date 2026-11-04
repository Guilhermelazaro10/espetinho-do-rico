import { plural } from './plural';
import { diaMes } from './datas';

describe('plural', () => {
  it('singular só para 1', () => {
    expect(plural(1, 'item', 'itens')).toBe('1 item');
    expect(plural(0, 'item', 'itens')).toBe('0 itens');
    expect(plural(3, 'pedido', 'pedidos')).toBe('3 pedidos');
  });

  it('trata vazio como zero e pode devolver só a palavra', () => {
    expect(plural(undefined, 'lançamento', 'lançamentos')).toBe('0 lançamentos');
    expect(plural(1, 'ativo', 'ativos', true)).toBe('ativo');
  });
});

describe('diaMes', () => {
  it('formata o dia da loja sem passar por Date (sem deslocar pelo fuso)', () => {
    expect(diaMes('2026-10-27')).toBe('27/10');
    expect(diaMes('2026-11-02', true)).toBe('02/11/2026');
  });

  it('nunca devolve ISO nem quebra com vazio', () => {
    expect(diaMes(undefined)).toBe('—');
    expect(diaMes('2026-01-05T03:00:00.000Z')).toBe('05/01');
  });
});

describe('moedaCurta (rótulo de gráfico)', async () => {
  const { moedaCurta } = await import('./api');
  it('abaixo de mil mostra reais inteiros', () => {
    expect(moedaCurta(85000)).toBe('R$ 850');
    expect(moedaCurta(0)).toBe('R$ 0');
  });
  it('de mil em diante usa "mil" com uma casa até 10 mil', () => {
    expect(moedaCurta(120000)).toBe('R$ 1,2 mil');
    expect(moedaCurta(100000)).toBe('R$ 1 mil');
    expect(moedaCurta(1549000)).toBe('R$ 15 mil');
  });
});
