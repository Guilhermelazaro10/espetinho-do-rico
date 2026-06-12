import { useEffect } from 'react';

/*
 * Tempo real com três camadas:
 *  1. SSE (/api/eventos): o backend sinaliza mudanças e o cliente refaz a busca
 *  2. Polling de segurança a cada 15s — só com a aba visível (poupa bateria)
 *  3. Recarga imediata quando a aba volta a ficar visível
 */
export function useAtualizacaoAoVivo(recarregar) {
  useEffect(() => {
    const fonte = new EventSource('/api/eventos');
    fonte.onmessage = () => recarregar();

    const timer = setInterval(() => {
      if (!document.hidden) recarregar();
    }, 15000);

    const aoMudarVisibilidade = () => {
      if (!document.hidden) recarregar();
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    return () => {
      fonte.close();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [recarregar]);
}
