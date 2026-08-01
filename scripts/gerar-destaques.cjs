/* Gera as capas de Destaques do Instagram (Espetinho do Rico) em PNG 1080x1080. */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT = path.join(__dirname, '..', 'marketing', 'destaques');
fs.mkdirSync(OUT, { recursive: true });

// Ícones lucide (viewBox 24x24, traço) — mesma família do PDV.
const ICONES = {
  cardapio: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
  horario: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  delivery: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  localizacao: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  avaliacoes: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
};

function svgCapa(iconeInterno) {
  return `<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="disc" cx="50%" cy="43%" r="63%">
      <stop offset="0%" stop-color="#c8402b"/>
      <stop offset="58%" stop-color="#a8281f"/>
      <stop offset="100%" stop-color="#771c1c"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1080" fill="#771c1c"/>
  <circle cx="540" cy="540" r="528" fill="url(#disc)"/>
  <circle cx="540" cy="540" r="486" fill="none" stroke="#fffcf7" stroke-opacity="0.9" stroke-width="9"/>
  <circle cx="540" cy="540" r="462" fill="none" stroke="#d4a96e" stroke-opacity="0.5" stroke-width="3"/>
  <g transform="translate(540,540) scale(16) translate(-12,-12)" fill="none" stroke="#fffcf7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconeInterno}</g>
</svg>`;
}

(async () => {
  for (const [nome, inner] of Object.entries(ICONES)) {
    const arquivo = path.join(OUT, `destaque-${nome}.png`);
    await sharp(Buffer.from(svgCapa(inner))).png().toFile(arquivo);
    console.log('gerado:', path.basename(arquivo));
  }
  console.log('OK em', OUT);
})();
