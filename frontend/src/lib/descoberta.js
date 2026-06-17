import { obterServidor } from './servidor';

/*
 * Descoberta automática do PDV na rede local — sem plugins nativos.
 *
 * Estratégia: varre faixas de IP (/24) fazendo GET /health em paralelo e
 * confirma o PDV pela assinatura `app: "espetinho-pdv"`. Como o desktop quase
 * sempre permanece na MESMA sub-rede quando o roteador troca seu IP, varrer a
 * sub-rede do último endereço conhecido reencontra o servidor em segundos.
 *
 * As requisições passam pelo CapacitorHttp (nativo), então não há barreira de
 * CORS / cleartext durante a varredura.
 */
export const ASSINATURA = 'espetinho-pdv';

// Sub-redes /24 comuns em roteadores domésticos no Brasil (busca ampla)
export const SUBREDES_COMUNS = [
  '192.168.0',
  '192.168.1',
  '192.168.15',
  '192.168.18',
  '192.168.25',
  '10.0.0',
];

function baseDeSubrede(ip) {
  const m = String(ip).match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  return m ? m[1] : null;
}

// Garante que nenhuma sonda trave o pool além do tempo-limite, mesmo que o
// AbortController seja ignorado pela camada nativa.
function corrida(promessa, ms) {
  return Promise.race([promessa, new Promise((r) => setTimeout(() => r(null), ms))]);
}

async function sondar(ip, porta, sinal) {
  const base = `http://${ip}:${porta}`;
  const ctrl = new AbortController();
  const cancelar = () => ctrl.abort();
  sinal?.addEventListener('abort', cancelar);
  try {
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const dados = await res.json().catch(() => null);
    if (dados?.app !== ASSINATURA) return null;
    return { base, nome: dados.nome ?? null };
  } catch {
    return null;
  } finally {
    sinal?.removeEventListener('abort', cancelar);
  }
}

/*
 * Varre uma ou mais sub-redes /24. Retorna o primeiro PDV encontrado
 * ({ base, nome }) e cancela o restante. `aoProgresso(feitos, total)` é
 * opcional, para a barra de progresso.
 */
export async function varrerRede({
  subredes,
  porta = 3001,
  aoProgresso,
  concorrencia = 40,
  timeoutPorHost = 1200,
} = {}) {
  const alvos = [];
  for (const s of subredes ?? []) {
    for (let i = 1; i <= 254; i++) alvos.push(`${s}.${i}`);
  }
  if (alvos.length === 0) return null;

  let achado = null;
  let proximo = 0;
  let feitos = 0;
  const controlador = new AbortController();

  async function trabalhador() {
    while (!achado && proximo < alvos.length) {
      const ip = alvos[proximo++];
      const r = await corrida(sondar(ip, porta, controlador.signal), timeoutPorHost);
      feitos += 1;
      aoProgresso?.(feitos, alvos.length);
      if (r && !achado) {
        achado = r;
        controlador.abort(); // cancela as sondas restantes
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concorrencia, alvos.length) }, trabalhador)
  );
  return achado;
}

/*
 * Localização automática no início do app (nativo):
 *  1. o endereço salvo responde? usa ele (rápido, IP não mudou).
 *  2. senão, varre a MESMA sub-rede do último endereço (IP mudou no mesmo
 *     roteador) — o caso comum que motivou tudo isso.
 * Retorna { base, nome } ou null. A busca ampla é ação explícita do usuário.
 */
export async function localizarPDV({ aoProgresso } = {}) {
  const salvo = obterServidor();
  if (!salvo) return null;
  try {
    const u = new URL(salvo);
    const porta = Number(u.port) || 3001;
    const direto = await corrida(sondar(u.hostname, porta, null), 1500);
    if (direto) return direto;

    const base3 = baseDeSubrede(u.hostname);
    if (base3) return await varrerRede({ subredes: [base3], porta, aoProgresso });
  } catch {
    /* endereço salvo inválido — ignora e deixa o usuário configurar */
  }
  return null;
}

// Busca ampla acionada pelo usuário (primeira instalação / trocou de rede)
export async function buscarEmTodaRede({ aoProgresso, porta = 3001 } = {}) {
  return varrerRede({ subredes: SUBREDES_COMUNS, porta, aoProgresso });
}
