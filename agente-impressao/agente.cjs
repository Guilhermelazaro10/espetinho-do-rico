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
 * Descoberta automática: se "impressora" no config for "auto" (ou o IP fixo não
 * responder), o agente VARRE a rede local procurando uma térmica na porta 9100
 * e usa a que achar — e grava o IP no config.json pra ser instantâneo na próxima.
 *
 * Logo: linhas iguais a "[[LOGO]]" no conteúdo são trocadas pela imagem
 * (config "logo", padrão logo.png) impressa centralizada no topo do cupom.
 *
 * Requer Node 18+ (usa fetch nativo). A lib da impressora só é carregada quando
 * vai imprimir de verdade — então --dry roda em qualquer máquina.
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

const DRY = process.argv.includes('--dry');
const TESTE = process.argv.includes('--teste');

const MARCADOR_LOGO = '[[LOGO]]'; // precisa bater com o backend (printerService)

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
    impressora: process.env.PRINTER_INTERFACE || arquivo.impressora || 'auto',
    logo: process.env.PRINTER_LOGO || arquivo.logo || 'logo.png',
    characterSet: process.env.PRINTER_CHARACTER_SET || arquivo.characterSet || 'WPC1252',
    intervaloMs: Number(process.env.AGENTE_INTERVALO_MS || arquivo.intervaloMs || 2000),
  };
}

const cfg = carregarConfig();

function log(...partes) {
  console.log(new Date().toLocaleTimeString('pt-BR'), '|', ...partes);
}

/* ---------- descoberta automática da impressora (porta 9100) ---------- */

let interfaceImpressora = null; // resolvida 1x e reaproveitada; zera ao falhar

function extrairIp(iface) {
  const m = /tcp:\/\/([^:/]+)/.exec(iface || '');
  return m ? m[1] : null;
}

// sub-redes /24 das interfaces locais (ex.: "192.168.1")
function subRedesLocais() {
  const bases = new Set();
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === 'IPv4' && !i.internal) {
        bases.add(i.address.split('.').slice(0, 3).join('.'));
      }
    }
  }
  return [...bases];
}

function porta9100Aberta(ip, timeout = 400) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host: ip, port: 9100 });
    let fechado = false;
    const fim = (ok) => {
      if (fechado) return;
      fechado = true;
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeout);
    s.on('connect', () => fim(true));
    s.on('timeout', () => fim(false));
    s.on('error', () => fim(false));
  });
}

async function descobrirImpressora() {
  for (const base of subRedesLocais()) {
    const candidatos = [];
    for (let n = 1; n <= 254; n++) candidatos.push(`${base}.${n}`);
    const LOTE = 32; // varre em lotes pra não abrir 254 sockets de uma vez
    for (let i = 0; i < candidatos.length; i += LOTE) {
      const grupo = candidatos.slice(i, i + LOTE);
      const achados = await Promise.all(
        grupo.map(async (ip) => ((await porta9100Aberta(ip)) ? ip : null))
      );
      const ip = achados.find(Boolean);
      if (ip) return ip;
    }
  }
  return null;
}

function gravarImpressoraNoConfig(iface) {
  try {
    const caminho = path.join(__dirname, 'config.json');
    if (!fs.existsSync(caminho)) return;
    const atual = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    atual.impressora = iface;
    fs.writeFileSync(caminho, JSON.stringify(atual, null, 2));
  } catch {
    /* sem permissão de escrita? tudo bem, segue só em memória */
  }
}

async function resolverInterface() {
  if (interfaceImpressora) return interfaceImpressora;

  const configurada = cfg.impressora;
  if (configurada && configurada !== 'auto') {
    const ip = extrairIp(configurada);
    if (ip && (await porta9100Aberta(ip))) {
      interfaceImpressora = configurada;
      return interfaceImpressora;
    }
    log('impressora configurada não respondeu — procurando na rede...');
  } else {
    log('procurando a impressora na rede (porta 9100)...');
  }

  const ip = await descobrirImpressora();
  if (!ip) {
    throw new Error('nenhuma impressora encontrada na rede (porta 9100). Ela está ligada e no cabo de rede?');
  }
  interfaceImpressora = `tcp://${ip}:9100`;
  log('impressora encontrada em', interfaceImpressora);
  gravarImpressoraNoConfig(interfaceImpressora);
  return interfaceImpressora;
}

/* ---------- impressão ---------- */

// A lib da impressora só é exigida aqui (modo --dry nunca chega nela)
function criarImpressora(iface) {
  const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');
  return new ThermalPrinter({
    type: PrinterTypes.EPSON, // GET é ESC/POS compatível
    interface: iface, // tcp://ip:9100
    characterSet: (CharacterSet && CharacterSet[cfg.characterSet]) || undefined,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
}

async function imprimirLogo(impressora) {
  const caminho = path.isAbsolute(cfg.logo) ? cfg.logo : path.join(__dirname, cfg.logo);
  if (!fs.existsSync(caminho)) return; // sem logo configurada/encontrada → ignora
  try {
    impressora.alignCenter();
    await impressora.printImage(caminho);
    impressora.alignLeft();
  } catch (erro) {
    impressora.alignLeft();
    log('aviso: não consegui imprimir a logo (' + erro.message + ') — segue sem ela.');
  }
}

async function imprimirLinhas(linhas, abrirGaveta) {
  if (DRY) {
    log('[DRY] imprimiria:\n' + linhas.join('\n') + (abrirGaveta ? '\n[abrir gaveta]' : ''));
    return;
  }
  const iface = await resolverInterface();
  const impressora = criarImpressora(iface);
  const conectada = await impressora.isPrinterConnected();
  if (!conectada) {
    interfaceImpressora = null; // força redescoberta na próxima (IP pode ter mudado)
    throw new Error('impressora não conectada em ' + iface);
  }
  for (const linha of linhas) {
    if (linha === MARCADOR_LOGO) {
      await imprimirLogo(impressora);
    } else {
      impressora.println(linha);
    }
  }
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
  log('Teste | charset', cfg.characterSet);
  await imprimirLinhas(
    [
      MARCADOR_LOGO,
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
      'Se a logo e os acentos sairam certos, esta tudo',
      'ok. Se os acentos sairam tortos, troque o',
      'characterSet no config.json (ex.: PC860_PORTUGUESE).',
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
  // tenta localizar a impressora já no boot (não fatal — o ciclo tenta de novo)
  if (!DRY) {
    try {
      await resolverInterface();
    } catch (erro) {
      log(erro.message);
    }
  }
  ciclo();
})();
