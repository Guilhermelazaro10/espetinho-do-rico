/*
 * Trava a regressão descrita em tests/setup-env.js: o token que os testes
 * emitem precisa ser aceito pelo middleware de autenticação MESMO quando o
 * `@prisma/client` já carregou o `backend/.env` e sobrescreveu o ambiente.
 *
 * Sem o setupFiles do jest, este teste falha em qualquer máquina que tenha um
 * `.env` com JWT_SECRET — e passa nas que não têm. Era essa assimetria que
 * fazia a CI ficar verde enquanto a suíte local acusava 401.
 */
// A ordem abaixo replica pedidos-online.test.js e é ESSENCIAL: o helper lê o
// segredo ao ser carregado, o Prisma injeta o .env depois, e só então o
// middleware lê o seu. Trocar a ordem esconde o bug que este arquivo vigia.
const { tokenDe } = require('./helpers/token');
require('@prisma/client');
const { autenticar } = require('../src/middlewares/auth');

function autenticarCom(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  let seguiu = false;
  autenticar(req, {}, () => {
    seguiu = true;
  });
  return { seguiu, usuario: req.usuario };
}

describe('segredo JWT dos testes', () => {
  it('está fixado, e não herdado do .env da máquina', () => {
    expect(process.env.JWT_SECRET).toBe('segredo-fixo-para-os-testes-nao-usar-em-producao');
  });

  it('o token do helper é aceito pelo middleware', () => {
    const { seguiu, usuario } = autenticarCom(tokenDe('GARCOM'));
    expect(seguiu).toBe(true);
    expect(usuario).toMatchObject({ papel: 'GARCOM' });
  });

  it('continua rejeitando token assinado com outro segredo', () => {
    const jwt = require('jsonwebtoken');
    const intruso = jwt.sign({ id: 1, papel: 'GERENTE' }, 'segredo-errado');
    expect(() => autenticarCom(intruso)).toThrow(/Sessão inválida/);
  });
});
