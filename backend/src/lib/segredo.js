const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/*
 * Segredo JWT persistente por instalação.
 *
 * Em produção os launchers (Electron / LAN) chamam `obterOuCriarSegredo` e
 * injetam o valor em `process.env.JWT_SECRET` ANTES de subir o app — assim o
 * token nunca usa o segredo de desenvolvimento que vive no código-fonte.
 */
function obterOuCriarSegredo(caminhoArquivo) {
  try {
    if (fs.existsSync(caminhoArquivo)) {
      const existente = fs.readFileSync(caminhoArquivo, 'utf8').trim();
      if (existente.length >= 32) return existente;
    }
  } catch {
    /* arquivo ilegível — recria abaixo */
  }

  const segredo = crypto.randomBytes(48).toString('hex');
  try {
    fs.mkdirSync(path.dirname(caminhoArquivo), { recursive: true });
    fs.writeFileSync(caminhoArquivo, segredo, { encoding: 'utf8', mode: 0o600 });
  } catch {
    /* sem permissão de escrita: usa o segredo só nesta sessão (melhor que o fixo) */
  }
  return segredo;
}

module.exports = { obterOuCriarSegredo };
