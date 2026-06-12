import { obterSessao, limparSessao } from './sessao';

/*
 * Cliente HTTP da API do PDV.
 * - Convenção monetária: a API fala em CENTAVOS (inteiros); `moeda()` formata.
 * - Token JWT vai em todas as chamadas; 401 derruba a sessão local.
 * - Falha de rede marca err.offline para a fila offline do garçom decidir.
 */
async function requisitar(rota, opcoes = {}) {
  const sessao = obterSessao();
  let res;
  try {
    res = await fetch(`/api${rota}`, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...(sessao?.token ? { Authorization: `Bearer ${sessao.token}` } : {}),
        ...opcoes.headers,
      },
      body: opcoes.body != null ? JSON.stringify(opcoes.body) : undefined,
    });
  } catch {
    const erro = new Error('Servidor indisponível. Verifique a conexão.');
    erro.offline = true;
    throw erro;
  }

  if (res.status === 401 && !rota.startsWith('/auth')) {
    limparSessao();
    window.dispatchEvent(new Event('pdv:sessao-expirada'));
    throw new Error('Sessão expirada — entre novamente');
  }
  if (res.status === 204) return null;

  const dados = await res.json().catch(() => null);
  if (!res.ok) {
    const erro = new Error(dados?.erro || `Erro ${res.status} no servidor`);
    if (res.status === 503) erro.offline = true; // service worker sem rede
    throw erro;
  }
  return dados;
}

export const api = {
  auth: {
    login: (pin) => requisitar('/auth/login', { method: 'POST', body: { pin } }),
  },
  mesas: {
    listar: () => requisitar('/mesas'),
    conta: (id) => requisitar(`/mesas/${id}/conta`),
    preConta: (id) => requisitar(`/mesas/${id}/pre-conta`, { method: 'POST' }),
    pagar: (id, pagamento) =>
      requisitar(`/mesas/${id}/pagamentos`, { method: 'POST', body: pagamento }),
    definirTaxa: (id, ativa) =>
      requisitar(`/mesas/${id}/taxa`, { method: 'PATCH', body: { ativa } }),
    atualizarStatus: (id, status) =>
      requisitar(`/mesas/${id}/status`, { method: 'PATCH', body: { status } }),
  },
  pedidos: {
    listarAbertos: (tipo) =>
      requisitar(`/pedidos?abertos=true${tipo ? `&tipo=${tipo}` : ''}`),
    criar: (corpo) => requisitar('/pedidos', { method: 'POST', body: corpo }),
    atualizarStatus: (id, status) =>
      requisitar(`/pedidos/${id}/status`, { method: 'PATCH', body: { status } }),
    pagar: (id, formaPagamento) =>
      requisitar(`/pedidos/${id}/pagamento`, { method: 'PATCH', body: { formaPagamento } }),
    cancelar: (id, motivo) =>
      requisitar(`/pedidos/${id}/cancelar`, { method: 'POST', body: { motivo } }),
    removerItem: (pedidoId, itemId) =>
      requisitar(`/pedidos/${pedidoId}/itens/${itemId}`, { method: 'DELETE' }),
    imprimir: (id) => requisitar(`/pedidos/${id}/imprimir`, { method: 'POST' }),
  },
  produtos: {
    listar: (incluirInativos = false) =>
      requisitar(`/produtos${incluirInativos ? '?incluirInativos=true' : ''}`),
    criar: (corpo) => requisitar('/produtos', { method: 'POST', body: corpo }),
    atualizar: (id, corpo) => requisitar(`/produtos/${id}`, { method: 'PUT', body: corpo }),
    desativar: (id) => requisitar(`/produtos/${id}`, { method: 'DELETE' }),
    reativar: (id) => requisitar(`/produtos/${id}/reativar`, { method: 'POST' }),
  },
  usuarios: {
    listar: () => requisitar('/usuarios'),
    criar: (corpo) => requisitar('/usuarios', { method: 'POST', body: corpo }),
    novoPin: (id) => requisitar(`/usuarios/${id}/novo-pin`, { method: 'POST' }),
    desligar: (id) => requisitar(`/usuarios/${id}`, { method: 'DELETE' }),
  },
  relatorios: {
    faturamento: (periodo = 'dia') => requisitar(`/relatorios/faturamento?periodo=${periodo}`),
  },
};

// Formata CENTAVOS como moeda brasileira
export function moeda(centavos) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (centavos ?? 0) / 100
  );
}

// Converte texto em reais ("12,50") para centavos inteiros (1250)
export function paraCentavos(texto) {
  const numero = Number(String(texto).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.round(numero * 100);
}
