/*
 * Fila offline de pedidos do garçom.
 * Pedido que falha por falta de rede entra aqui e é reenviado
 * automaticamente quando a conexão volta (evento online + varredura).
 */
const CHAVE = 'pdv.fila-pedidos';

export function listarFila() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) ?? [];
  } catch {
    return [];
  }
}

function gravar(fila) {
  localStorage.setItem(CHAVE, JSON.stringify(fila));
}

export function adicionarNaFila(pedido) {
  const item = {
    chave: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: new Date().toISOString(),
    ...pedido,
  };
  gravar([...listarFila(), item]);
  return item;
}

export function removerDaFila(chave) {
  gravar(listarFila().filter((p) => p.chave !== chave));
}

/**
 * Tenta reenviar todos os pedidos da fila usando a função `enviar`.
 * Para no primeiro erro de rede (sem conexão, tentar depois);
 * erros de validação descartam o pedido (não vai entrar nunca).
 */
export async function sincronizarFila(enviar) {
  const resultado = { enviados: 0, descartados: 0, restantes: 0 };
  for (const pendente of listarFila()) {
    try {
      await enviar({ mesaId: pendente.mesaId, itens: pendente.itens });
      removerDaFila(pendente.chave);
      resultado.enviados += 1;
    } catch (erro) {
      if (erro.offline) break; // ainda sem rede — preserva a fila
      removerDaFila(pendente.chave); // rejeitado pelo servidor — não insistir
      resultado.descartados += 1;
    }
  }
  resultado.restantes = listarFila().length;
  return resultado;
}
