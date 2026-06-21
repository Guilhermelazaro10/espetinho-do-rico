const app = require('./app');
const logger = require('./lib/logger');

const PORT = process.env.PORT || 3001;
// Em produção atrás do Caddy, HOST=127.0.0.1 prende a API no loopback (só o
// proxy alcança). LAN/desktop deixam vazio → 0.0.0.0 (acessível na rede local).
const HOST = process.env.HOST || '0.0.0.0';

// Redes de segurança de processo: erros fora do ciclo request/response
// (os erros de rota já são absorvidos pelo middleware global do app).
process.on('unhandledRejection', (reason) => {
  logger.erro('unhandledRejection', { motivo: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.erro('uncaughtException', { erro: err.message, stack: err.stack });
});

app.listen(PORT, HOST, () => {
  logger.info(`API Espetinho do Rico no ar`, { porta: Number(PORT), host: HOST });
});
