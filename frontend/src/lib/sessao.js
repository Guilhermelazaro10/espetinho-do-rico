// Sessão do operador (token JWT + dados do usuário) em localStorage.
const CHAVE = 'pdv.sessao';

export function obterSessao() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE));
  } catch {
    return null;
  }
}

export function salvarSessao(sessao) {
  localStorage.setItem(CHAVE, JSON.stringify(sessao));
}

// Também apaga o Cache Storage do PDV: versões antigas do service worker
// guardavam respostas privadas da API (caixa, pedidos) que sobreviviam ao logout.
export async function limparSessao() {
  localStorage.removeItem(CHAVE);
  try {
    if (!window.caches) return;
    const nomes = await window.caches.keys();
    await Promise.all(nomes.filter((n) => n.startsWith('espetinho-pdv')).map((n) => window.caches.delete(n)));
  } catch {
    // Sem Cache Storage (contexto inseguro / navegador antigo): nada a limpar
  }
}
