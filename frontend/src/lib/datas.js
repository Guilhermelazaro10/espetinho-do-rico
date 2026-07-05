// Fuso da loja (Jaguaruana/CE). Fixamos o fuso pra que a hora/data exibida
// seja SEMPRE a da loja — e não a do aparelho do cliente/funcionário, que
// pode estar em outro fuso ou mal configurado (relógio adiantado/atrasado).
export const FUSO_LOJA = 'America/Fortaleza';

// Hora curta "HH:MM" no fuso da loja.
export function horaLoja(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: FUSO_LOJA,
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Data + hora no fuso da loja (opções extras do toLocaleString são aceitas).
export function dataHoraLoja(iso, opcoes = {}) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO_LOJA, ...opcoes });
}

// Só a data no fuso da loja.
export function dataLoja(iso, opcoes = {}) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO_LOJA, ...opcoes });
}

// Minutos inteiros desde um instante (Cozinha usa pra cor de urgência).
export function minutosDesde(iso, agora = Date.now()) {
  return Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000));
}

// Rótulo de tempo decorrido: "agora", "há 12 min", "há 1h05".
export function desdeMin(iso, agora = Date.now()) {
  const min = minutosDesde(iso, agora);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}
