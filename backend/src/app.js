const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { ipsPrivados } = require('./lib/rede');
const routes = require('./routes');
const authRoutes = require('./routes/auth.routes');
const eventosRoutes = require('./routes/eventos.routes');
const impressaoRoutes = require('./routes/impressao.routes');
const publicoRoutes = require('./routes/publico.routes');
const { autenticar } = require('./middlewares/auth');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

const app = express();

// Headers de segurança. CSP fica desligado (a SPA usa estilos inline + Google
// Fonts; uma CSP estrita quebraria sem ajuste fino — Cloudflare cobre isso).
app.use(helmet({ contentSecurityPolicy: false }));
// gzip nas respostas (SPA + JSON). NUNCA comprime o stream SSE: o buffer do
// compressor seguraria os eventos e mataria o tempo real atrás de proxy.
app.use(
  compression({
    filter: (req, res) =>
      res.getHeader('Content-Type') !== 'text/event-stream' && compression.filter(req, res),
  })
);

// CORS restrito às origens conhecidas (frontend dev e build de produção).
// Requisições same-origin (sem header Origin) passam normalmente.
const ORIGENS_PERMITIDAS = (
  process.env.ALLOWED_ORIGINS ||
  // dev/preview do Vite + origens do app nativo Capacitor (APK Android)
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:4173,http://127.0.0.1:4173,http://localhost,https://localhost,capacitor://localhost'
)
  .split(',')
  .map((o) => o.trim());

const origemLocalDev = (origem) =>
  process.env.NODE_ENV !== 'production' &&
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origem);

const origemRedeLocal = (origem) =>
  process.env.ALLOW_LAN_ORIGINS === 'true' &&
  /^http:\/\/(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(origem);

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

// Health check + assinatura de descoberta: confirma API de pé e identifica
// o PDV na varredura de rede do app (público). Sem contagens do banco — eram
// dado de negócio exposto e uma query sem autenticação a cada hit.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'espetinho-pdv', nome: os.hostname() });
});

app.get('/api/rede', autenticar, (req, res) => {
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

// Fila de impressão: autenticada por token de AGENTE (máquina), não por usuário
app.use('/api/impressao', impressaoRoutes);

// Cardápio online + pedidos do cliente: público (sem login), com anti-spam
app.use('/api/publico', publicoRoutes);

// Todo o restante da API exige autenticação de usuário
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
