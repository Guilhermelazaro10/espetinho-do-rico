import { describe, it, expect } from 'vitest';
import { moeda, paraCentavos } from './api';

describe('moeda — formatação de centavos', () => {
  it('formata centavos como BRL', () => {
    expect(moeda(4800)).toMatch(/R\$\s?48,00/);
    expect(moeda(105)).toMatch(/R\$\s?1,05/);
    expect(moeda(0)).toMatch(/R\$\s?0,00/);
  });

  it('tolera null/undefined', () => {
    expect(moeda(null)).toMatch(/0,00/);
    expect(moeda(undefined)).toMatch(/0,00/);
  });
});

describe('paraCentavos — entrada do operador em reais', () => {
  it('converte vírgula decimal', () => {
    expect(paraCentavos('48,00')).toBe(4800);
    expect(paraCentavos('1,05')).toBe(105);
    expect(paraCentavos('0,5')).toBe(50);
  });

  it('aceita milhar com ponto', () => {
    expect(paraCentavos('1.250,00')).toBe(125000);
  });

  it('entrada inválida ou negativa vira zero', () => {
    expect(paraCentavos('abc')).toBe(0);
    expect(paraCentavos('-10')).toBe(0);
    expect(paraCentavos('')).toBe(0);
  });

  it('sem erro de ponto flutuante', () => {
    expect(paraCentavos('0,1') + paraCentavos('0,2')).toBe(30);
  });
});
