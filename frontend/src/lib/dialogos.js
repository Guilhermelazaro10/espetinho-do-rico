/*
 * API imperativa de diálogos com visual próprio (substitui window.confirm/prompt,
 * que destoam da UI e podem ser bloqueados em PWA instalado).
 *
 *   await confirmar({ titulo, mensagem, confirmarRotulo, perigo })  -> boolean
 *   await pedirTexto({ titulo, mensagem, placeholder, obrigatorio }) -> string | null
 *
 * Um único host (DialogosGlobais) registra o handler. Sem host (ex.: testes),
 * cai no nativo pra não travar.
 */
let host = null;

export function _registrarHost(fn) {
  host = fn;
}

export function confirmar(opcoes = {}) {
  if (!host) return Promise.resolve(window.confirm(opcoes.mensagem ?? opcoes.titulo ?? ''));
  return host({ tipo: 'confirmar', ...opcoes });
}

export function pedirTexto(opcoes = {}) {
  if (!host) return Promise.resolve(window.prompt(opcoes.mensagem ?? opcoes.titulo ?? ''));
  return host({ tipo: 'texto', ...opcoes });
}
