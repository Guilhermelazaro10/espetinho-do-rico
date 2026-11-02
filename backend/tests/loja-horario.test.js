/*
 * Horário da loja no cardápio online.
 *
 * Turno que vira a meia-noite (17:00 às 02:00): a 01:00 de domingo ainda é o
 * turno de SÁBADO. O código olhava só o dia do relógio (domingo) e fechava a
 * loja no meio do movimento; e na terça à 01:00 abria, embora segunda não abra.
 *
 * Fuso é o da loja (America/Fortaleza), nunca o do servidor (UTC na VPS).
 */

const ENV_ORIGINAL = { ...process.env };

function carregarLoja(env) {
  let loja;
  jest.isolateModules(() => {
    Object.assign(process.env, env);
    loja = require('../src/loja');
  });
  return loja;
}

const TURNO_DA_MADRUGADA = { LOJA_DIAS: '2,3,4,5,6', LOJA_ABERTURA: '17:00', LOJA_FECHAMENTO: '02:00' };

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  process.env = { ...ENV_ORIGINAL };
});

describe('turno que vira a meia-noite', () => {
  it('domingo à 01:00 está ABERTA (é o turno de sábado)', () => {
    jest.setSystemTime(new Date('2026-11-01T04:00:00Z')); // dom 01:00 em Fortaleza
    expect(carregarLoja(TURNO_DA_MADRUGADA).statusHorario().aberto).toBe(true);
  });

  it('terça à 01:00 está FECHADA (segunda não abre)', () => {
    jest.setSystemTime(new Date('2026-11-03T04:00:00Z')); // ter 01:00 em Fortaleza
    expect(carregarLoja(TURNO_DA_MADRUGADA).statusHorario().aberto).toBe(false);
  });

  it('domingo às 03:00 está fechada (turno de sábado já acabou)', () => {
    jest.setSystemTime(new Date('2026-11-01T06:00:00Z'));
    expect(carregarLoja(TURNO_DA_MADRUGADA).statusHorario().aberto).toBe(false);
  });

  it('sábado às 23:00 está aberta', () => {
    jest.setSystemTime(new Date('2026-11-01T02:00:00Z')); // sáb 23:00 em Fortaleza
    expect(carregarLoja(TURNO_DA_MADRUGADA).statusHorario().aberto).toBe(true);
  });

  it('terça à 01:00 a próxima abertura é hoje às 17:00', () => {
    jest.setSystemTime(new Date('2026-11-03T04:00:00Z'));
    expect(carregarLoja(TURNO_DA_MADRUGADA).proximaAbertura().texto).toBe('hoje às 17:00');
  });

  it('domingo às 03:00 a próxima abertura é terça', () => {
    jest.setSystemTime(new Date('2026-11-01T06:00:00Z'));
    expect(carregarLoja(TURNO_DA_MADRUGADA).proximaAbertura().texto).toBe('ter, 03/11 às 17:00');
  });
});

describe('fuso da loja', () => {
  it('usa America/Fortaleza', () => {
    const fonte = require('fs').readFileSync(require.resolve('../src/loja'), 'utf8');
    expect(fonte).toContain("'America/Fortaleza'");
    expect(fonte).not.toContain('America/Sao_Paulo');
  });
});
