const fs = require('fs/promises');
const path = require('path');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const logger = require('../lib/logger');
const impressaoService = require('./impressaoService');

/*
 * PrinterService — cupom de produção em impressora térmica 80mm.
 *
 * Fluxo: tenta a térmica (interface configurável via PRINTER_INTERFACE);
 * se não detectada, fallback automático gera um .txt na raiz do backend
 * com a formatação exata da bobina (48 colunas, Fonte A).
 *
 * Nada aqui trava o Event Loop: toda I/O é assíncrona, a detecção da
 * impressora tem tempo-limite, e o disparo é agendado fora do ciclo
 * request/response (setImmediate + promessa não aguardada).
 */

const LARGURA = 48; // colunas úteis em bobina 80mm com Fonte A
const MARCADOR_LOGO = '[[LOGO]]'; // o agente troca por logo.png (precisa bater com agente.cjs)
const TEMPO_LIMITE_MS = 2000;
const PASTA_CUPONS = path.join(__dirname, '..', '..', 'cupons');
const INTERFACE_IMPRESSORA = process.env.PRINTER_INTERFACE || 'printer:POS80';

// 'local' (padrão): imprime direto na máquina (desktop Electron/LAN).
// 'queue': enfileira o cupom para o agente da loja imprimir (modo nuvem/VPS).
const MODO_IMPRESSAO = process.env.PRINT_MODE === 'queue' ? 'queue' : 'local';

/* ---------- formatação de bobina ---------- */

function centralizar(texto) {
  const corte = texto.slice(0, LARGURA);
  const sobra = LARGURA - corte.length;
  return ' '.repeat(Math.floor(sobra / 2)) + corte;
}

function divisoria(caractere = '-') {
  return caractere.repeat(LARGURA);
}

function justificar(esquerda, direita) {
  const dir = String(direita);
  const esq = String(esquerda).slice(0, LARGURA - dir.length - 1);
  return esq + ' '.repeat(LARGURA - esq.length - dir.length) + dir;
}

function quebrarTexto(texto, largura) {
  const palavras = texto.split(/\s+/);
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    if ((atual + ' ' + palavra).trim().length > largura) {
      if (atual) linhas.push(atual);
      atual = palavra;
    } else {
      atual = (atual + ' ' + palavra).trim();
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function moeda(centavos) {
  return `R$ ${(Number(centavos) / 100).toFixed(2).replace('.', ',')}`;
}

/*
 * Identidade da loja, impressa no topo e no rodapé de todo cupom. Tudo
 * centralizado na bobina de 48 colunas. (A logo em imagem é renderizada
 * pelo agente da loja no modo nuvem — ver agente-impressao.)
 */
const LOJA = {
  nome: 'ESPETINHO DO RICO',
  endereco: ['Rua Adolfo Francisco da Rocha, 608', 'Bairro Juazeiro - Jaguaruana/CE'],
  telefone: '', // ex.: 'WhatsApp (88) 9 0000-0000' — só imprime se preenchido
  rodape: ['Obrigado pela preferencia!', 'Volte sempre, o Rico te espera!'],
};

function cabecalhoLoja() {
  const linhas = [divisoria('=')];
  linhas.push(centralizar(LOJA.nome));
  for (const linha of LOJA.endereco) linhas.push(centralizar(linha));
  if (LOJA.telefone) linhas.push(centralizar(LOJA.telefone));
  return linhas;
}

function rodapeLoja() {
  const linhas = [''];
  for (const linha of LOJA.rodape) linhas.push(centralizar(linha));
  linhas.push(divisoria('='));
  return linhas;
}

/**
 * Monta as linhas do cupom (mesma fonte de verdade para térmica e .txt).
 * Exportada para testes.
 */
function formatarDataHora(data) {
  return new Date(data ?? Date.now()).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function montarLinhasCupom(pedido) {
  const dataHora = formatarDataHora(pedido.criadoEm);
  const tipo = pedido.tipo ?? 'MESA';

  const linhas = [];
  linhas.push(...cabecalhoLoja());
  linhas.push(centralizar('Cupom de Producao'));
  linhas.push(divisoria('='));
  linhas.push(justificar(`PEDIDO #${pedido.id}`, dataHora));
  linhas.push('');

  if (tipo === 'DELIVERY') {
    linhas.push(centralizar('***  DELIVERY  ***'));
    linhas.push('');
    linhas.push(`Cliente: ${pedido.clienteNome ?? '-'}`.slice(0, LARGURA));
    linhas.push(`Fone: ${pedido.clienteTelefone ?? '-'}`.slice(0, LARGURA));
    for (const l of quebrarTexto(`Entrega: ${pedido.clienteEndereco ?? '-'}`, LARGURA)) {
      linhas.push(l);
    }
  } else if (tipo === 'BALCAO') {
    linhas.push(centralizar('***  BALCAO / RETIRADA  ***'));
    linhas.push('');
    linhas.push(centralizar(`Cliente: ${pedido.clienteNome ?? '-'}`));
  } else {
    const numeroMesa = String(pedido.mesa?.numero ?? pedido.mesaId).padStart(2, '0');
    linhas.push(centralizar(`***  MESA ${numeroMesa}  ***`));
  }
  linhas.push('');
  linhas.push(divisoria());
  linhas.push(justificar('ITEM', 'QTD'));
  linhas.push(divisoria());

  for (const item of pedido.itens ?? []) {
    linhas.push(justificar(item.produto?.nome ?? `Produto ${item.produtoId}`, `x${item.quantidade}`));
    if (item.observacao) {
      // Observações destacadas: bloco indentado em caixa alta com marcador
      for (const linha of quebrarTexto(item.observacao.toUpperCase(), LARGURA - 8)) {
        linhas.push(`  >>> ${linha}`);
      }
    }
  }

  linhas.push(divisoria());
  if (pedido.taxaEntrega > 0) {
    linhas.push(justificar('Itens', moeda(pedido.total - pedido.taxaEntrega)));
    linhas.push(justificar('Taxa de entrega', moeda(pedido.taxaEntrega)));
  }
  linhas.push(justificar('TOTAL DO PEDIDO', moeda(pedido.total)));
  linhas.push(...rodapeLoja());
  return linhas;
}

/**
 * Pré-conta (conferência) da mesa: todos os consumos, taxa e total.
 * Impressão disparada pelo garçom ao "Fechar Conta" — não é documento fiscal.
 */
function montarLinhasPreConta({ mesa, comandas, subtotal, taxa, totalDevido, pago, saldoDevedor }) {
  const linhas = [];
  linhas.push(...cabecalhoLoja());
  linhas.push(centralizar('PRE-CONTA / CONFERENCIA'));
  linhas.push(centralizar('NAO E DOCUMENTO FISCAL'));
  linhas.push(divisoria('='));
  linhas.push(justificar(`MESA ${String(mesa.numero).padStart(2, '0')}`, formatarDataHora()));
  linhas.push(divisoria());

  for (const comanda of comandas) {
    for (const item of comanda.itens) {
      linhas.push(
        justificar(
          `${item.quantidade}x ${item.produto?.nome ?? `Produto ${item.produtoId}`}`,
          moeda(item.precoUnitario * item.quantidade)
        )
      );
    }
  }

  linhas.push(divisoria());
  linhas.push(justificar('Subtotal', moeda(subtotal)));
  if (taxa > 0) linhas.push(justificar('Taxa de servico 10%', moeda(taxa)));
  if (pago > 0) {
    linhas.push(justificar('Pago parcialmente', `- ${moeda(pago)}`));
    linhas.push(justificar('SALDO A PAGAR', moeda(saldoDevedor)));
  } else {
    linhas.push(justificar('TOTAL A PAGAR', moeda(totalDevido)));
  }
  linhas.push('');
  linhas.push(centralizar('Pagamento somente no caixa'));
  linhas.push(...rodapeLoja());
  return linhas;
}

/* ---------- saídas ---------- */

function comTempoLimite(promessa, ms, mensagem) {
  let timer;
  const limite = new Promise((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(mensagem)), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}

async function imprimirNaTermica(linhas) {
  const impressora = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: INTERFACE_IMPRESSORA,
    options: { timeout: TEMPO_LIMITE_MS },
  });

  const conectada = await comTempoLimite(
    Promise.resolve(impressora.isPrinterConnected()),
    TEMPO_LIMITE_MS,
    'tempo esgotado ao detectar a impressora'
  );
  if (!conectada) throw new Error('impressora USB não detectada');

  for (const linha of linhas) {
    impressora.println(linha);
  }
  impressora.cut();
  await comTempoLimite(impressora.execute(), TEMPO_LIMITE_MS, 'tempo esgotado ao imprimir');
}

async function salvarCupomTxt(nomeArquivo, linhas) {
  await fs.mkdir(PASTA_CUPONS, { recursive: true });
  const arquivo = path.join(PASTA_CUPONS, nomeArquivo);
  await fs.writeFile(arquivo, linhas.join('\n') + '\n', 'utf8');
  return arquivo;
}

/**
 * Imprime o cupom do pedido; na ausência da térmica, cai para .txt.
 * Nunca lança para o chamador.
 */
async function emitir(linhas, nomeArquivo, contexto) {
  try {
    await imprimirNaTermica(linhas);
    logger.info('cupom impresso na térmica', contexto);
    return { destino: 'termica' };
  } catch (motivo) {
    try {
      const arquivo = await salvarCupomTxt(nomeArquivo, linhas);
      logger.info('térmica indisponível — cupom salvo em arquivo', {
        ...contexto,
        motivo: motivo.message,
        arquivo: path.basename(arquivo),
      });
      return { destino: 'arquivo', arquivo };
    } catch (erroArquivo) {
      logger.erro('falha total ao emitir cupom', { ...contexto, erro: erroArquivo.message });
      return { destino: 'falha' };
    }
  }
}

async function imprimirCupom(pedido) {
  return emitir(montarLinhasCupom(pedido), `cupom-pedido-${pedido.id}.txt`, {
    pedidoId: pedido.id,
  });
}

async function imprimirPreConta(conta) {
  return emitir(
    montarLinhasPreConta(conta),
    `pre-conta-mesa-${conta.mesa.numero}-${Date.now()}.txt`,
    { mesa: conta.mesa.numero }
  );
}

async function enfileirar(tipo, refId, linhas, abrirGaveta = false) {
  await impressaoService.enfileirar({ tipo, refId, conteudo: linhas.join('\n'), abrirGaveta });
}

// No modo nuvem o agente desenha a logo no topo (troca o marcador pela imagem).
function comLogo(linhas) {
  return [MARCADOR_LOGO, ...linhas];
}

/**
 * Disparos fire-and-forget: agendados para o próximo tick, fora do caminho
 * da resposta HTTP. Em 'local' imprime direto; em 'queue' enfileira para o
 * agente da loja. A operação nunca espera (nem cai por causa) da impressão.
 */
function dispararImpressao(pedido) {
  setImmediate(() => {
    const tarefa =
      MODO_IMPRESSAO === 'queue'
        ? enfileirar('cupom', pedido.id, comLogo(montarLinhasCupom(pedido)))
        : imprimirCupom(pedido);
    tarefa.catch((erro) =>
      logger.erro('erro inesperado na impressão', { pedidoId: pedido.id, erro: erro.message })
    );
  });
}

function dispararImpressaoPreConta(conta) {
  setImmediate(() => {
    const tarefa =
      MODO_IMPRESSAO === 'queue'
        ? enfileirar('pre_conta', conta.mesa?.id ?? null, comLogo(montarLinhasPreConta(conta)))
        : imprimirPreConta(conta);
    tarefa.catch((erro) =>
      logger.erro('erro inesperado na pré-conta', { mesa: conta.mesa?.numero, erro: erro.message })
    );
  });
}

module.exports = {
  dispararImpressao,
  dispararImpressaoPreConta,
  imprimirCupom,
  montarLinhasCupom,
  montarLinhasPreConta,
  LARGURA,
};
