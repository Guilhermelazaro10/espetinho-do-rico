import { describe, it, expect } from 'vitest';
import { moeda, paraCentavos } from './api';
import { desdeMin, minutosDesde } from './datas';

// Dinheiro é digitado como texto ("12,50") e vira CENTAVOS inteiros.
// Esses testes travam os casos que já quebraram PDV por aí: milhar com
// ponto, entrada inválida, negativo e arredondamento.
describe('paraCentavos — entrada de dinheiro digitada', () => {
  it('converte reais com vírgula', () => {
    expect(paraCentavos('12,50')).toBe(1250);
    expect(paraCentavos('0,05')).toBe(5);
  });

  it('aceita milhar com ponto (1.234,56)', () => {
    expect(paraCentavos('1.234,56')).toBe(123456);
  });

  it('inteiro sem centavos vale x100', () => {
    expect(paraCentavos('7')).toBe(700);
  });

  it('entrada inválida vira zero (nunca NaN)', () => {
    expect(paraCentavos('abc')).toBe(0);
    expect(paraCentavos('')).toBe(0);
  });

  it('negativo vira zero (não existe pagamento negativo)', () => {
    expect(paraCentavos('-10,00')).toBe(0);
  });

  it('arredonda meio centavo sem perder precisão binária', () => {
    expect(paraCentavos('0,1') + paraCentavos('0,2')).toBe(30); // 0.1+0.2 já era…
  });
});

describe('moeda — exibição em reais', () => {
  it('formata centavos como BRL', () => {
    expect(moeda(1250)).toMatch(/R\$\s?12,50/);
  });

  it('nulo/indefinido mostra zero em vez de quebrar', () => {
    expect(moeda(null)).toMatch(/R\$\s?0,00/);
    expect(moeda(undefined)).toMatch(/R\$\s?0,00/);
  });
});

describe('tempo decorrido (cards do delivery/cozinha)', () => {
  const base = new Date('2026-07-05T20:00:00.000Z').getTime();

  it('menos de 1 minuto é "agora"', () => {
    expect(desdeMin(new Date(base - 20_000).toISOString(), base)).toBe('agora');
  });

  it('minutos exibem "há X min"', () => {
    expect(desdeMin(new Date(base - 12 * 60_000).toISOString(), base)).toBe('há 12 min');
  });

  it('acima de 1h vira "há 1h05"', () => {
    expect(desdeMin(new Date(base - 65 * 60_000).toISOString(), base)).toBe('há 1h05');
  });

  it('relógio adiantado no cliente não gera minutos negativos', () => {
    expect(minutosDesde(new Date(base + 60_000).toISOString(), base)).toBe(0);
  });
});
