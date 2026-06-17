const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

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

// Segredo JWT por instalação (nunca o segredo de desenvolvimento do código)
const { obterOuCriarSegredo } = require(path.join(raiz, 'backend', 'src', 'lib', 'segredo.js'));
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = obterOuCriarSegredo(path.join(raiz, 'backend', '.jwt-secret'));
}

// Garante o schema do banco em dia (idempotente)
const cliPrisma = path.join(raiz, 'backend', 'node_modules', 'prisma', 'build', 'index.js');
const schemaPrisma = path.join(raiz, 'backend', 'prisma', 'schema.prisma');
if (fs.existsSync(cliPrisma)) {
  spawnSync(process.execPath, [cliPrisma, 'migrate', 'deploy', '--schema', schemaPrisma], {
    stdio: 'ignore',
    timeout: 60000,
  });
}

const app = require(path.join(raiz, 'backend', 'src', 'app.js'));
const { ipsPrivados } = require(path.join(raiz, 'backend', 'src', 'lib', 'rede.js'));

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
