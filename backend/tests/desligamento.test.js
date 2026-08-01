const { criarDesligador } = require('../src/lib/desligamento');

// O desligamento roda em todo deploy: se ele cortar uma requisição em voo,
// o prejuízo é um pagamento pela metade. Estes testes travam o contrato.

function criarLoggerFalso() {
  return { info: jest.fn(), aviso: jest.fn(), erro: jest.fn() };
}

/**
 * Servidor HTTP falso. `close(cb)` só chama o callback quando `concluir()`
 * for invocado — é assim que simulamos requisição em voo (ou o SSE, que
 * nunca termina sozinho).
 */
function criarServidorFalso() {
  let concluirClose;
  return {
    close: jest.fn((cb) => {
      concluirClose = cb;
    }),
    closeIdleConnections: jest.fn(),
    closeAllConnections: jest.fn(() => concluirClose?.()),
    concluir: () => concluirClose?.(),
  };
}

describe('desligamento gracioso', () => {
  it('espera a requisição em voo, fecha o banco e sai com 0', async () => {
    const servidor = criarServidorFalso();
    const fecharBanco = jest.fn().mockResolvedValue();
    const sair = jest.fn();
    const desligar = criarDesligador({
      servidor, prazoMs: 50, fecharBanco, logger: criarLoggerFalso(), sair,
    });

    const promessa = desligar('SIGTERM');

    // Parou de aceitar conexão nova e liberou as ociosas de imediato...
    expect(servidor.close).toHaveBeenCalled();
    expect(servidor.closeIdleConnections).toHaveBeenCalled();
    // ...mas ainda NÃO fechou o banco: a requisição em voo não terminou.
    expect(fecharBanco).not.toHaveBeenCalled();
    expect(sair).not.toHaveBeenCalled();

    servidor.concluir(); // requisição em voo terminou
    await promessa;

    expect(fecharBanco).toHaveBeenCalled();
    expect(sair).toHaveBeenCalledWith(0);
  });

  it('derruba o SSE quando o prazo estoura (senão o deploy travaria)', async () => {
    const servidor = criarServidorFalso(); // nunca conclui sozinho, como o SSE
    const sair = jest.fn();
    const desligar = criarDesligador({
      servidor,
      prazoMs: 20,
      fecharBanco: jest.fn().mockResolvedValue(),
      logger: criarLoggerFalso(),
      sair,
    });

    await desligar('SIGTERM');

    expect(servidor.closeAllConnections).toHaveBeenCalled();
    expect(sair).toHaveBeenCalledWith(0);
  });

  it('varre conexões ociosas continuamente, não só uma vez', async () => {
    // A conexão que estava atendendo a requisição só fica ociosa DEPOIS que
    // ela termina. Sem varredura contínua ela seguraria o desligamento até o
    // keepAliveTimeout do Node (5s) — deploy lento a cada atualização.
    const servidor = criarServidorFalso();
    const desligar = criarDesligador({
      servidor,
      prazoMs: 400,
      fecharBanco: jest.fn().mockResolvedValue(),
      logger: criarLoggerFalso(),
      sair: jest.fn(),
    });

    const promessa = desligar('SIGTERM');
    await new Promise((r) => setTimeout(r, 250)); // requisição ainda em voo
    const varredurasAteAgora = servidor.closeIdleConnections.mock.calls.length;

    servidor.concluir();
    await promessa;

    expect(varredurasAteAgora).toBeGreaterThan(1);
  });

  it('sinal repetido não reinicia o fluxo', async () => {
    const servidor = criarServidorFalso();
    const fecharBanco = jest.fn().mockResolvedValue();
    const desligar = criarDesligador({
      servidor, prazoMs: 20, fecharBanco, logger: criarLoggerFalso(), sair: jest.fn(),
    });

    const primeiro = desligar('SIGINT');
    await desligar('SIGINT'); // segundo Ctrl+C: deve ser ignorado
    servidor.concluir();
    await primeiro;

    expect(servidor.close).toHaveBeenCalledTimes(1);
    expect(fecharBanco).toHaveBeenCalledTimes(1);
  });

  it('banco falhando ao desconectar não impede a saída', async () => {
    const servidor = criarServidorFalso();
    const sair = jest.fn();
    const logger = criarLoggerFalso();
    const desligar = criarDesligador({
      servidor,
      prazoMs: 20,
      fecharBanco: jest.fn().mockRejectedValue(new Error('banco travado')),
      logger,
      sair,
    });

    const promessa = desligar('SIGTERM');
    servidor.concluir();
    await promessa;

    expect(sair).toHaveBeenCalledWith(0);
    expect(logger.erro).toHaveBeenCalledWith(
      'falha ao desconectar do banco',
      expect.objectContaining({ erro: 'banco travado' })
    );
  });

  it('uncaughtException sai com código 1 (systemd sobe processo limpo)', async () => {
    const servidor = criarServidorFalso();
    const sair = jest.fn();
    const desligar = criarDesligador({
      servidor,
      prazoMs: 20,
      fecharBanco: jest.fn().mockResolvedValue(),
      logger: criarLoggerFalso(),
      sair,
    });

    const promessa = desligar('uncaughtException', 1);
    servidor.concluir();
    await promessa;

    expect(sair).toHaveBeenCalledWith(1);
  });
});
