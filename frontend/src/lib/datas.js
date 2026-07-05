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
