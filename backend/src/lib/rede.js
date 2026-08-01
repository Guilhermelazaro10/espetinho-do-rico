const os = require('os');

// IPs IPv4 privados (LAN) da máquina — usado pelo /api/rede e pelos launchers.
function ipsPrivados() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address)
    .filter(
      (ip) =>
        /^10\./.test(ip) ||
        /^192\.168\./.test(ip) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
}

/*
 * Confiança em proxy (TRUST_PROXY).
 *
 * Vazio/false = a API fala direto com o cliente (LAN, desktop, dev).
 * true        = há 1 proxy na frente (VPS: Cloudflare → Caddy → Node).
 * número      = essa quantidade de saltos.
 *
 * Isso não é detalhe de configuração: headers de IP são texto livre. Confiar
 * neles sem proxy na frente deixa qualquer cliente forjar a própria
 * identidade e escapar do bloqueio de força-bruta do PIN.
 */
function confiaEmProxy() {
  const valor = String(process.env.TRUST_PROXY ?? '').trim().toLowerCase();
  return valor !== '' && valor !== 'false' && valor !== '0';
}

// Quantos saltos de proxy o Express deve considerar ao resolver req.ip.
function saltosDeProxy() {
  const numero = Number(String(process.env.TRUST_PROXY ?? '').trim());
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

/**
 * IP real do cliente, para rate-limit e auditoria.
 *
 * Atrás do Cloudflare o IP do socket é sempre o do proxy, e o IP verdadeiro
 * chega em CF-Connecting-IP — header que o Cloudflare SOBRESCREVE, por isso
 * é confiável ali. Sem proxy na frente ele é apenas um texto enviado pelo
 * cliente: ignoramos, senão bastaria variar o header a cada tentativa para
 * tornar o limite de login inofensivo.
 */
function ipDoCliente(req) {
  if (confiaEmProxy()) {
    const informado = req.headers?.['cf-connecting-ip'];
    if (typeof informado === 'string' && informado.trim()) return informado.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'desconhecido';
}

module.exports = { ipsPrivados, confiaEmProxy, saltosDeProxy, ipDoCliente };
