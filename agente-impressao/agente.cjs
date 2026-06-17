/*
 * Agente de impressão — Espetinho do Rico
 *
 * Roda no PC do caixa (sempre ligado). Puxa os cupons da fila do PDV na nuvem
 * (/api/impressao) e imprime na térmica de rede GET via tcp://IP:9100.
 *
 * Modos:
 *   node agente.cjs           → roda em loop (produção)
 *   node agente.cjs --teste   → imprime 1 cupom de teste (valida impressora/acentos)
 *   node agente.cjs --dry     → NÃO toca na impressora; mostra os cupons no console
 *                               (útil pra validar a conexão com o PDV sem hardware)
 *
 * Config: agente-impressao/config.json (veja config.example.json) ou variáveis
 * de ambiente (PDV_URL, PRINT_AGENT_TOKEN, PRINTER_INTERFACE, PRINTER_CHARACTER_SET).
 *
 * Requer Node 18+ (usa fetch nativo). A lib da impressora só é carregada quando
 * vai imprimir de verdade — então --dry roda em qualquer máquina.
 */
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const TESTE = process.argv.includes('--teste');

function carregarConfig() {
  let arquivo = {};
  const caminho = path.join(__dirname, 'config.json');
  if (fs.existsSync(caminho)) {
    try {
      arquivo = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    } catch {
      console.error('config.json inválido (JSON malformado).');
      process.exit(1);
    }
  }
  return {
    pdvUrl: (process.env.PDV_URL || arquivo.pdvUrl || '').replace(/\/+$/, ''),
    token: process.env.PRINT_AGENT_TOKEN || arquivo.token || '',
    impressora: process.env.PRINTER_INTERFACE || arquivo.impressora || 'tcp://192.168.0.50:9100',
    characterSet: process.env.PRINTER_CHARACTER_SET || arquivo.characterSet || 'WPC1252',
    intervaloMs: Number(process.env.AGENTE_INTERVALO_MS || arquivo.intervaloMs || 2000),
  };
}

const cfg = carregarConfig();

function log(...partes) {
  console.log(new Date().toLocaleTimeString('pt-BR'), '|', ...partes);
}

// A lib da impressora só é exigida aqui (modo --dry nunca chega nela)
function criarImpressora() {
  const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');
  return new ThermalPrinter({
    type: PrinterTypes.EPSON, // GET é ESC/POS compatível
    interface: cfg.impressora, // tcp://ip:9100, ou USB/serial
    characterSet: (CharacterSet && CharacterSet[cfg.characterSet]) || undefined,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
}

async function imprimirLinhas(linhas, abrirGaveta) {
  if (DRY) {
    log('[DRY] imprimiria:\n' + linhas.join('\n') + (abrirGaveta ? '\n[abrir gaveta]' : ''));
    return;
  }
  const impressora = criarImpressora();
  const conectada = await impressora.isPrinterConnected();
  if (!conectada) throw new Error('impressora não conectada em ' + cfg.impressora);
  for (const linha of linhas) impressora.println(linha);
  if (abrirGaveta) impressora.openCashDrawer();
  impressora.cut();
  await impressora.execute();
}

async function api(metodo, rota, corpo) {
  const res = await fetch(`${cfg.pdvUrl}${rota}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!res.ok) throw new Error(`${metodo} ${rota} -> HTTP ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function ciclo() {
  try {
    const jobs = await api('GET', '/api/impressao/proximos?limite=5');
    for (const job of jobs ?? []) {
      try {
        await imprimirLinhas(String(job.conteudo).split('\n'), job.abrirGaveta);
        await api('POST', `/api/impressao/${job.id}/concluir`);
        log(`impresso #${job.id} (${job.tipo})`);
      } catch (erro) {
        await api('POST', `/api/impressao/${job.id}/falhar`, { erro: erro.message }).catch(() => {});
        log(`FALHA #${job.id}:`, erro.message);
      }
    }
  } catch (erro) {
    log('sem conexão com o PDV:', erro.message);
  } finally {
    setTimeout(ciclo, cfg.intervaloMs);
  }
}

async function imprimirTeste() {
  log('Teste em', cfg.impressora, '| charset', cfg.characterSet);
  await imprimirLinhas(
    [
      '================================================',
      '          ESPETINHO DO RICO - TESTE             ',
      '================================================',
      'Acentos: Medalhao -> Medalhão',
      'Pao, Acai, Limao, Sao, coracao',
      'C cedilha: Acougue  | til: pao, irmaos',
      '------------------------------------------------',
      '2x Espeto de Carne                     R$ 24,00',
      '1x Cerveja                              R$  8,00',
      '------------------------------------------------',
      'Se os acentos sairam certos, o charset esta ok.',
      'Se sairam tortos, troque o characterSet no',
      'config.json (ex.: PC860_PORTUGUESE).',
      '================================================',
    ],
    false
  );
  log('Teste enviado. Confira o papel.');
}

(async () => {
  if (!cfg.pdvUrl || !cfg.token) {
    console.error('Faltou configurar pdvUrl e token (config.json ou variáveis de ambiente).');
    process.exit(1);
  }
  log('Agente iniciado | PDV:', cfg.pdvUrl, '| impressora:', cfg.impressora, DRY ? '| MODO DRY' : '');
  if (TESTE) {
    await imprimirTeste();
    process.exit(0);
  }
  ciclo();
})();
