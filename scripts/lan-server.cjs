const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const frontendDist = path.join(raiz, 'frontend', 'dist');
const banco = path.join(raiz, 'backend', 'prisma', 'dev.db');
const porta = Number(process.env.PORT || 3001);

if (!fs.existsSync(path.join(frontendDist, 'index.html'))) {
  console.error('Build do frontend nao encontrado. Rode: npm run build:frontend');
  process.exit(1);
}

if (!fs.existsSync(banco)) {
  console.error('Banco SQLite nao encontrado. Rode: npm run seed -w backend');
  process.exit(1);
}

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.FRONTEND_DIST = frontendDist;
process.env.DATABASE_URL = `file:${banco.replace(/\\/g, '/')}`;
process.env.ALLOW_LAN_ORIGINS = 'true';

const app = require(path.join(raiz, 'backend', 'src', 'app.js'));

function ipsPrivados() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address)
    .filter((ip) =>
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
}

const server = http.createServer(app);

server.listen(porta, '0.0.0.0', () => {
  const ips = ipsPrivados();

  console.log('');
  console.log('PDV Espetinho do Rico em modo rede local');
  console.log('------------------------------------------');
  console.log(`Caixa neste computador: http://localhost:${porta}`);
  console.log('');
  console.log('Abra no celular dos garcons:');
  if (ips.length === 0) {
    console.log(`  http://IP-DO-COMPUTADOR:${porta}`);
    console.log('');
    console.log('Nao encontrei um IP privado automaticamente. Confira o Wi-Fi/rede do Windows.');
  } else {
    for (const ip of ips) console.log(`  http://${ip}:${porta}/#/garcom`);
  }
  console.log('');
  console.log('PIN garcom: 1111');
  console.log('PIN gerente: 9999');
  console.log('');
  console.log('Mantenha esta janela aberta enquanto os celulares estiverem usando o PDV.');
  console.log('Para parar: Ctrl + C');
});
