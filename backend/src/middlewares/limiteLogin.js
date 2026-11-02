const AppError = require('../errors/AppError');
const { ipDoCliente } = require('../lib/rede');

/*
 * Limite de tentativas de login por IP (anti força-bruta de PIN), em memória.
 * Sem dependência externa. Após MAX falhas, bloqueia com backoff crescente.
 * Sucesso zera o contador.
 */
const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000; // falhas expiram após 15 min de inatividade
const BLOQUEIO_BASE_MS = 30 * 1000; // 30s no 1º bloqueio, dobrando
const BLOQUEIO_MAX_MS = 15 * 60 * 1000;

// Limite GLOBAL (todos os IPs somados): o bloqueio por IP não segura um ataque
// distribuído, em que cada IP erra poucas vezes. Passou de MAX_FALHAS_GLOBAL
// falhas no último minuto, ninguém tenta login por BLOQUEIO_GLOBAL_MS.
const MAX_FALHAS_GLOBAL = 30;
const JANELA_GLOBAL_MS = 60 * 1000;
const BLOQUEIO_GLOBAL_MS = 60 * 1000;

const registros = new Map(); // ip -> { falhas, ultimaEm, bloqueadoAte }
let ultimaLimpeza = 0;
let falhasGlobais = []; // instantes das falhas no último minuto (no máx. ~31)
let bloqueioGlobalAte = 0;

// Remove IPs inativos além da janela (impede o Map crescer pra sempre).
function limpar(agora) {
  if (agora - ultimaLimpeza < JANELA_MS) return;
  ultimaLimpeza = agora;
  for (const [ip, reg] of registros) {
    if (agora - reg.ultimaEm > JANELA_MS && (!reg.bloqueadoAte || agora >= reg.bloqueadoAte)) {
      registros.delete(ip);
    }
  }
}

// Balde por IP real do cliente. O header CF-Connecting-IP só entra quando há
// proxy declarado (TRUST_PROXY) — sem isso qualquer um trocaria o header a
// cada tentativa e cairia num balde novo, anulando o bloqueio. Ver lib/rede.
function chave(req) {
  return ipDoCliente(req);
}

function erroBloqueio(ate, agora) {
  const seg = Math.ceil((ate - agora) / 1000);
  return new AppError(`Muitas tentativas. Aguarde ${seg}s e tente novamente.`, 429);
}

function verificar(req) {
  const agora = Date.now();
  if (agora < bloqueioGlobalAte) throw erroBloqueio(bloqueioGlobalAte, agora);
  limpar(agora);
  const reg = registros.get(chave(req));
  if (!reg) return;
  if (agora - reg.ultimaEm > JANELA_MS) {
    registros.delete(chave(req));
    return;
  }
  if (reg.bloqueadoAte && agora < reg.bloqueadoAte) throw erroBloqueio(reg.bloqueadoAte, agora);
}

function falhou(req) {
  const k = chave(req);
  const agora = Date.now();
  const reg = registros.get(k) ?? { falhas: 0, ultimaEm: agora, bloqueadoAte: 0 };
  reg.falhas += 1;
  reg.ultimaEm = agora;
  if (reg.falhas >= MAX_FALHAS) {
    const excedente = reg.falhas - MAX_FALHAS;
    const duracao = Math.min(BLOQUEIO_BASE_MS * 2 ** excedente, BLOQUEIO_MAX_MS);
    reg.bloqueadoAte = agora + duracao;
  }
  registros.set(k, reg);

  falhasGlobais = falhasGlobais.filter((t) => agora - t < JANELA_GLOBAL_MS);
  falhasGlobais.push(agora);
  if (falhasGlobais.length > MAX_FALHAS_GLOBAL) {
    bloqueioGlobalAte = agora + BLOQUEIO_GLOBAL_MS;
    falhasGlobais = [];
  }
}

function ok(req) {
  registros.delete(chave(req));
}

// Para os testes não vazarem estado entre suítes
function _resetar() {
  registros.clear();
  falhasGlobais = [];
  bloqueioGlobalAte = 0;
}

module.exports = { verificar, falhou, ok, _resetar, MAX_FALHAS };
