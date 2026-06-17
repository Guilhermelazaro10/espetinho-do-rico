import { Capacitor } from '@capacitor/core';

/*
 * Endereço do PDV (servidor desktop).
 *
 * No app NATIVO (APK) o shell roda em localhost dentro do aparelho, então as
 * chamadas de API precisam de um endereço ABSOLUTO até o desktop — guardado
 * aqui em localStorage e independente do IP de instalação (resolve o problema
 * de "reinstalar o PWA quando o roteador troca o IP").
 *
 * No NAVEGADOR/PWA usamos caminho relativo (mesma origem / proxy do Vite),
 * então a base é vazia e nada muda no comportamento atual.
 */
const CHAVE = 'pdv.servidor';

export function ehNativo() {
  return Capacitor.isNativePlatform();
}

export function obterServidor() {
  return localStorage.getItem(CHAVE) || '';
}

export function salvarServidor(url) {
  const limpo = normalizar(url);
  if (limpo) localStorage.setItem(CHAVE, limpo);
  return limpo;
}

export function limparServidor() {
  localStorage.removeItem(CHAVE);
}

// Prefixo aplicado a todas as chamadas de API.
// Nativo → endereço configurado; web → '' (relativo).
export function baseUrl() {
  return ehNativo() ? obterServidor() : '';
}

// Só o app nativo sem servidor salvo precisa passar pela tela de configuração.
export function precisaConfigurar() {
  return ehNativo() && !obterServidor();
}

/*
 * Normaliza entradas variadas para "http://host:porta":
 *   "192.168.0.10"            -> "http://192.168.0.10:3001"
 *   "192.168.0.10:3001"       -> "http://192.168.0.10:3001"
 *   "http://192.168.0.10:3001" -> idem
 * Porta padrão 3001 quando omitida. Retorna '' se inválido.
 */
export function normalizar(entrada) {
  let v = String(entrada ?? '').trim().replace(/\/+$/, '');
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname) return '';
    const porta = u.port || '3001';
    return `${u.protocol}//${u.hostname}:${porta}`;
  } catch {
    return '';
  }
}

/*
 * Testa a conexão com o PDV via /health (rota pública, sem autenticação).
 * Retorna { base, dados } em caso de sucesso; lança Error legível caso falhe.
 */
export async function testarServidor(entrada) {
  const base = normalizar(entrada);
  if (!base) throw new Error('Endereço inválido');

  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), 4000);
  try {
    const res = await fetch(`${base}/health`, { signal: controlador.signal });
    if (!res.ok) throw new Error(`O servidor respondeu ${res.status}`);
    const dados = await res.json();
    if (dados?.status !== 'ok') throw new Error('Resposta inesperada do servidor');
    if (dados.app && dados.app !== 'espetinho-pdv') {
      throw new Error('Esse endereço responde, mas não é o PDV');
    }
    return { base, dados };
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw new Error('Tempo esgotado — confira o IP e se estão na mesma rede', { cause: erro });
    }
    if (
      erro.message?.startsWith('O servidor') ||
      erro.message?.startsWith('Resposta') ||
      erro.message?.startsWith('Esse endereço')
    ) {
      throw erro;
    }
    throw new Error('Não foi possível alcançar o PDV nesse endereço', { cause: erro });
  } finally {
    clearTimeout(limite);
  }
}
