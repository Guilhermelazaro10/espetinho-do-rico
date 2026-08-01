/*
 * Campainha do PDV — som de "novo pedido online" gerado por WebAudio
 * (sem arquivo de áudio para carregar/falhar).
 *
 * Navegadores só liberam áudio depois de uma interação do usuário: o
 * contexto é criado/resumido no primeiro toque na tela. Se um pedido chegar
 * antes de qualquer toque, o aviso visual (toast) cobre.
 */
let contexto = null;

function obterContexto() {
  if (!contexto) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    contexto = new Ctor();
  }
  return contexto;
}

// Primeiro gesto do usuário destrava o áudio para o resto da sessão
function destravarAudio() {
  const ctx = obterContexto();
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}
window.addEventListener('pointerdown', destravarAudio, { once: false, passive: true });
window.addEventListener('keydown', destravarAudio, { passive: true });

function tocarNota(ctx, frequencia, inicio, duracao, volume = 0.28) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequencia;
  // Envelope: sobe rápido e decai suave — soa "sino", não "buzina"
  ganho.gain.setValueAtTime(0, inicio);
  ganho.gain.linearRampToValueAtTime(volume, inicio + 0.015);
  ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.05);
}

/** "Din-don" duplo de balcão — chama atenção sem assustar. */
export function tocarCampainha() {
  const ctx = obterContexto();
  if (!ctx || ctx.state !== 'running') return; // áudio ainda não destravado
  const agora = ctx.currentTime;
  tocarNota(ctx, 987, agora, 0.35); // Si5
  tocarNota(ctx, 1318, agora + 0.18, 0.5); // Mi6
  tocarNota(ctx, 987, agora + 0.7, 0.35);
  tocarNota(ctx, 1318, agora + 0.88, 0.6);
}
