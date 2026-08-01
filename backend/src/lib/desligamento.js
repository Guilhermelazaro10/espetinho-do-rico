/*
 * Desligamento gracioso do servidor HTTP.
 *
 * Todo deploy reinicia o serviço (systemd), e uma requisição cortada no meio
 * pode ser um pagamento perdido. A ordem importa:
 *   1. parar de aceitar conexão nova    2. fechar as ociosas (keep-alive)
 *   3. dar prazo para as em voo         4. só então fechar o banco.
 *
 * As dependências entram por parâmetro (servidor, banco, sair) para o fluxo
 * ser testável sem derrubar o processo de verdade.
 */
function criarDesligador({ servidor, prazoMs, fecharBanco, logger, sair }) {
  let desligando = false;

  return async function desligar(sinal, codigoSaida = 0) {
    if (desligando) return; // SIGINT duplo (Ctrl+C martelado) não atropela o fluxo
    desligando = true;
    logger.info('desligamento iniciado', { sinal, prazoMs });

    // Rede de segurança: se qualquer etapa travar, o processo sai mesmo assim.
    // unref() para não segurar o event loop quando tudo correr bem.
    const saidaForcada = setTimeout(() => {
      logger.erro('desligamento travou — saída forçada', { sinal });
      sair(codigoSaida || 1);
    }, prazoMs + 5000);
    saidaForcada.unref?.();

    // Para de aceitar conexões; resolve quando as requisições em voo terminam.
    const pararDeServir = new Promise((resolve) => servidor.close(resolve));

    // Conexões keep-alive precisam ser varridas continuamente, não uma vez só:
    // a que estava atendendo uma requisição fica ociosa DEPOIS, e sozinha
    // seguraria o desligamento até o keepAliveTimeout do Node (5s). Varrendo,
    // o deploy termina assim que a última resposta sai.
    servidor.closeIdleConnections?.();
    const varreduraOciosas = setInterval(() => servidor.closeIdleConnections?.(), 200);
    varreduraOciosas.unref?.();

    // O SSE (/api/eventos) é uma conexão viva por natureza: sozinha ela nunca
    // fecha e seguraria o deploy até o SIGKILL. Passado o prazo, derrubamos o
    // que restou — o EventSource do cliente reconecta sozinho.
    const prazo = setTimeout(() => {
      logger.aviso('prazo esgotado — encerrando conexões restantes (SSE)');
      servidor.closeAllConnections?.();
    }, prazoMs);

    await pararDeServir;
    clearTimeout(prazo);
    clearInterval(varreduraOciosas);

    try {
      await fecharBanco();
    } catch (erro) {
      // Banco resistindo a fechar não pode impedir o processo de sair.
      logger.erro('falha ao desconectar do banco', { erro: erro.message });
    }

    clearTimeout(saidaForcada);
    logger.info('desligamento concluído', { sinal });
    sair(codigoSaida);
  };
}

module.exports = { criarDesligador };
