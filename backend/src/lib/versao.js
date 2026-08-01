const path = require('path');

/*
 * Versão do produto, exposta no /health.
 *
 * Sem isso não há como confirmar se um deploy realmente subiu o código novo:
 * o serviço responde "ok" tanto rodando a versão nova quanto a antiga.
 *
 * A raiz do monorepo é a fonte oficial (package.json do produto). Quando o
 * backend roda isolado — empacotado no Electron — a raiz não existe e caímos
 * no package.json do próprio backend.
 */
function lerVersao() {
  const candidatos = [
    path.join(__dirname, '..', '..', '..', 'package.json'), // raiz do monorepo
    path.join(__dirname, '..', '..', 'package.json'), // backend isolado
  ];
  for (const caminho of candidatos) {
    try {
      const { version } = require(caminho);
      if (version) return version;
    } catch {
      // Caminho inexistente nesse empacotamento: tenta o próximo.
    }
  }
  return 'desconhecida';
}

module.exports = { versao: lerVersao() };
