const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
const routes = require('./routes');
const authRoutes = require('./routes/auth.routes');
const eventosRoutes = require('./routes/eventos.routes');
const prisma = require('./lib/prisma');
const { autenticar } = require('./middlewares/auth');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// CORS restrito às origens conhecidas (frontend dev e build de produção).
// Requisições same-origin (sem header Origin) passam normalmente.
const ORIGENS_PERMITIDAS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173'
)
  .split(',')
  .map((o) => o.trim());

const origemLocalDev = (origem) =>
  process.env.NODE_ENV !== 'production' &&
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origem);

const origemRedeLocal = (origem) =>
  process.env.ALLOW_LAN_ORIGINS === 'true' &&
  /^http:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(origem);

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

app.use(
  cors({
    origin(origem, callback) {
      if (
        !origem ||
        ORIGENS_PERMITIDAS.includes(origem) ||
        origemLocalDev(origem) ||
        origemRedeLocal(origem)
      ) {
        return callback(null, true);
      }
      callback(new Error('Origem não permitida pelo CORS'));
    },
  })
);
app.use(express.json({ limit: '100kb' }));

// Health check: confirma API de pé e banco acessível (público)
app.get('/health', async (req, res) => {
  const [produtos, mesas] = await Promise.all([
    prisma.produto.count(),
    prisma.mesa.count(),
  ]);
  res.json({ status: 'ok', produtos, mesas });
});

app.get('/api/rede', (req, res) => {
  const porta = req.socket.localPort || Number(process.env.PORT || 3001);
  const ips = ipsPrivados();
  const urlsGarcom = ips.map((ip) => `http://${ip}:${porta}/#/garcom`);

  res.json({
    nomeComputador: os.hostname(),
    porta,
    ips,
    urlsGarcom,
    urlPreferencialGarcom: urlsGarcom[0] ?? `http://IP-DO-COMPUTADOR:${porta}/#/garcom`,
  });
});

// Rotas públicas: login e stream de sinalização SSE
app.use('/api/auth', authRoutes);
app.use('/api/eventos', eventosRoutes);

// Todo o restante da API exige autenticação
app.use('/api', autenticar, routes);

if (process.env.FRONTEND_DIST) {
  const dist = path.resolve(process.env.FRONTEND_DIST);
  const indexHtml = path.join(dist, 'index.html');

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(dist));
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) {
        return res.sendFile(indexHtml);
      }
      return next();
    });
  }
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
