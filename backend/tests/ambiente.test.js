/*
 * Barreira de boot: em produção o servidor não pode subir com o segredo de
 * desenvolvimento que está publicado no repositório.
 *
 * Sem isso, um .env.production ilegível (renomeado, permissão errada,
 * EnvironmentFile quebrado no systemd) fazia a API subir NORMALMENTE — atendendo
 * pedidos, aceitando login — mas assinando token com o fallback do código-fonte.
 * Quem lesse o repositório forjaria um token de GERENTE e liberaria as ações de
 * dinheiro. A falha era silenciosa; a ideia aqui é que ela grite no deploy.
 */
const { conferirAmbiente, SEGREDO_DEV } = require('../src/lib/ambiente');

const FORTE = 'a'.repeat(96);

describe('conferirAmbiente', () => {
  describe('fora de produção não atrapalha ninguém', () => {
    it('aceita ambiente de desenvolvimento sem JWT_SECRET', () => {
      expect(conferirAmbiente({ NODE_ENV: 'development' })).toEqual([]);
    });

    it('aceita o segredo de dev nos testes', () => {
      expect(conferirAmbiente({ NODE_ENV: 'test', JWT_SECRET: SEGREDO_DEV })).toEqual([]);
    });
  });

  describe('em produção', () => {
    it('recusa quando JWT_SECRET não foi definida', () => {
      const problemas = conferirAmbiente({ NODE_ENV: 'production' });
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toMatch(/JWT_SECRET/);
    });

    it('recusa o segredo de desenvolvimento do código-fonte', () => {
      const problemas = conferirAmbiente({ NODE_ENV: 'production', JWT_SECRET: SEGREDO_DEV });
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toMatch(/desenvolvimento/i);
    });

    it('recusa segredo curto demais para resistir a força bruta', () => {
      const problemas = conferirAmbiente({ NODE_ENV: 'production', JWT_SECRET: 'curto' });
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toMatch(/curt|32/i);
    });

    it('aceita um segredo forte', () => {
      expect(conferirAmbiente({ NODE_ENV: 'production', JWT_SECRET: FORTE })).toEqual([]);
    });

    it('nunca vaza o segredo na mensagem de erro', () => {
      const problemas = conferirAmbiente({ NODE_ENV: 'production', JWT_SECRET: 'curto' });
      expect(problemas.join(' ')).not.toContain('curto');
    });
  });
});

describe('o fallback barrado é o mesmo que o middleware usa', () => {
  // Se as duas cópias divergirem, conferirAmbiente aprova um segredo que a
  // autenticação de fato usa — a barreira existiria mas não pegaria nada.
  it('um token assinado com SEGREDO_DEV é aceito pelo middleware', () => {
    const original = process.env.JWT_SECRET;
    try {
      jest.isolateModules(() => {
        delete process.env.JWT_SECRET; // força o middleware a cair no fallback
        const jwt = require('jsonwebtoken');
        const { autenticar } = require('../src/middlewares/auth');

        const req = { headers: { authorization: `Bearer ${jwt.sign({ id: 1 }, SEGREDO_DEV)}` } };
        let seguiu = false;
        autenticar(req, {}, () => {
          seguiu = true;
        });
        expect(seguiu).toBe(true);
      });
    } finally {
      process.env.JWT_SECRET = original; // não contamina os testes seguintes
    }
  });
});

describe('exigirAmbienteValido', () => {
  const { exigirAmbienteValido } = require('../src/lib/ambiente');

  it('deixa o boot seguir quando está tudo certo', () => {
    const sair = jest.fn();
    exigirAmbienteValido({ NODE_ENV: 'production', JWT_SECRET: FORTE }, { sair });
    expect(sair).not.toHaveBeenCalled();
  });

  it('derruba o boot com código 1 quando o segredo é o de dev', () => {
    const sair = jest.fn();
    const registrar = jest.fn();
    exigirAmbienteValido({ NODE_ENV: 'production', JWT_SECRET: SEGREDO_DEV }, { sair, registrar });
    expect(sair).toHaveBeenCalledWith(1);
    expect(registrar).toHaveBeenCalled();
  });
});
