// Auditoria visual: captura todas as telas em 7 larguras e reprova o que quebra no celular.
// Uso: BASE_URL=http://localhost:4173 PIN_GERENTE=9999 node scripts/auditoria-visual.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const PIN = process.env.PIN_GERENTE || '9999';
const OUT = 'qa/screenshots';
const TAMANHOS = {
  '320': [320, 640], '360': [360, 780], '390': [390, 844], '768': [768, 1024],
  '1024': [1024, 768], '1366': [1366, 768], '1920': [1920, 1080],
};
const TELAS = {
  'cardapio-cliente': '/cardapio', login: '/#/', salao: '/#/', garcom: '/#/garcom', cozinha: '/#/cozinha',
  caixa: '/#/caixa', delivery: '/#/delivery', financeiro: '/#/financeiro', equipe: '/#/equipe',
  'cardapio-adm': '/#/cardapio', impressora: '/#/impressora',
};
const PUBLICAS = new Set(['cardapio-cliente', 'login']);

// Roda dentro da página. Devolve só problemas reais (cada um reprova a auditoria).
const INSPECIONAR = (toque) => {
  const vw = document.documentElement.clientWidth;
  const visivel = (el, r) => {
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const dentroDeRolagem = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  const fixoForaDaTela = (el) => {
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.transform !== 'none') return true;
      if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return true;
    }
    return false;
  };
  const nome = (el) =>
    (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const problemas = [];

  const sobra = document.documentElement.scrollWidth - vw;
  if (sobra > 0) problemas.push(`rolagem horizontal na página (+${sobra}px)`);

  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!visivel(el, r) || fixoForaDaTela(el)) continue;

    if (!dentroDeRolagem(el) && (r.right > vw + 1 || r.left < -1)) {
      problemas.push(`fora da tela: "${nome(el)}" (${Math.round(r.left)}→${Math.round(r.right)} de ${vw})`);
    }
    const interativo = el.matches('button, a[href], input:not([type=hidden]), select, textarea, [role=button]');
    if (toque && interativo && (r.height < 44 || r.width < 44)) {
      problemas.push(`alvo de toque pequeno: "${nome(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (temTexto && parseFloat(getComputedStyle(el).fontSize) < 12) {
      problemas.push(`texto miúdo: "${nome(el)}" ${getComputedStyle(el).fontSize}`);
    }
    if (temTexto && el.closest('[data-nome-produto]') && el.scrollWidth > el.clientWidth + 1) {
      problemas.push(`nome de produto cortado: "${nome(el)}"`);
    }
  }
  return [...new Set(problemas)];
};

const resp = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: PIN }),
});
if (!resp.ok) throw new Error(`Login falhou (${resp.status}). Backend no ar e PIN_GERENTE certo?`);
const sessao = await resp.json();

fs.mkdirSync(OUT, { recursive: true });
const navegador = await chromium.launch();
const relatorio = {};
let total = 0;

for (const [tam, [w, h]] of Object.entries(TAMANHOS)) {
  const toque = w < 1024;
  for (const [tela, rota] of Object.entries(TELAS)) {
    const ctx = await navegador.newContext({
      viewport: { width: w, height: h }, isMobile: toque, hasTouch: toque,
      serviceWorkers: 'block', locale: 'pt-BR', timezoneId: 'America/Fortaleza',
    });
    if (!PUBLICAS.has(tela)) {
      await ctx.addInitScript((s) => localStorage.setItem('pdv.sessao', s), JSON.stringify(sessao));
    }
    const pg = await ctx.newPage();
    const errosJs = [];
    pg.on('pageerror', (e) => errosJs.push(`erro JS: ${e.message.slice(0, 120)}`));
    await pg.goto(BASE + rota, { waitUntil: 'load' });
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: `${OUT}/${tela}-${tam}.png`, fullPage: true });
    const problemas = [...(await pg.evaluate(INSPECIONAR, toque)), ...errosJs];
    if (problemas.length) {
      relatorio[`${tela} @ ${tam}px`] = problemas;
      total += problemas.length;
    }
    await ctx.close();
  }
}
await navegador.close();

fs.writeFileSync('qa/relatorio-visual.json', JSON.stringify(relatorio, null, 2));
for (const [chave, lista] of Object.entries(relatorio)) {
  console.log(`\n✗ ${chave}`);
  for (const p of lista.slice(0, 12)) console.log(`   - ${p}`);
  if (lista.length > 12) console.log(`   … +${lista.length - 12}`);
}
console.log(total ? `\n${total} problema(s). Capturas em ${OUT}/` : `\nNenhum problema. Capturas em ${OUT}/`);
process.exit(total ? 1 : 0);
