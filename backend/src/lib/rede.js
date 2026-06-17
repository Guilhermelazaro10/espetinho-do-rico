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

module.exports = { ipsPrivados };
