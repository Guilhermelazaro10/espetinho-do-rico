const app = require('./app');
const logger = require('./lib/logger');
const prisma = require('./lib/prisma');
const { criarDesligador } = require('./lib/desligamento');

const PORT = process.env.PORT || 3001;
// Em produção atrás do Caddy, HOST=127.0.0.1 prende a API no loopback (só o
// proxy alcança). LAN/desktop deixam vazio → 0.0.0.0 (acessível na rede local).
const HOST = process.env.HOST || '0.0.0.0';

// Prazo para as requisições em voo terminarem durante um deploy. Precisa ser
// menor que o TimeoutStopSec do systemd (deploy/pdv.service), senão o serviço
// leva SIGKILL antes de fechar o banco.
const PRAZO_DESLIGAMENTO_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);

const servidor = app.listen(PORT, HOST, () => {
  logger.info('API Espetinho do Rico no ar', { porta: Number(PORT), host: HOST });
});

const desligar = criarDesligador({
  servidor,
  prazoMs: PRAZO_DESLIGAMENTO_MS,
  fecharBanco: () => prisma.$disconnect(),
  logger,
  sair: (codigo) => process.exit(codigo),
});

process.on('SIGTERM', () => desligar('SIGTERM')); // systemd (deploy/restart)
process.on('SIGINT', () => desligar('SIGINT')); // Ctrl+C no terminal

// Redes de segurança de processo: erros fora do ciclo request/response
// (os erros de rota já são absorvidos pelo middleware global do app).
process.on('unhandledRejection', (motivo) => {
  logger.erro('unhandledRejection', {
    motivo: motivo instanceof Error ? motivo.message : String(motivo),
    stack: motivo instanceof Error ? motivo.stack : undefined,
  });
});

process.on('uncaughtException', (erro) => {
  logger.erro('uncaughtException — encerrando por segurança', {
    erro: erro.message,
    stack: erro.stack,
  });
  // Depois de uma exceção não tratada o estado do processo é indefinido.
  // Continuar rodando arriscaria gravar valor errado no caixa: é mais seguro
  // sair e deixar o systemd (Restart=always) subir um processo limpo.
  desligar('uncaughtException', 1);
});

module.exports = { servidor, desligar };
