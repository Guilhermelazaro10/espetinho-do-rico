import { useEffect } from 'react';
import { ehNativo, baseUrl } from '../lib/servidor';

/*
 * Tempo real:
 *  - Web/PWA: SSE (/api/eventos) com polling de segurança a cada 15s.
 *  - App nativo (APK): EventSource cross-origin é instável, então pulamos o
 *    SSE e usamos polling mais frequente (8s). Em ambos, recarrega ao voltar
 *    a aba/foco e só com a tela visível (poupa bateria).
 */
export function useAtualizacaoAoVivo(recarregar) {
  useEffect(() => {
    let fonte = null;
    if (!ehNativo()) {
      fonte = new EventSource(`${baseUrl()}/api/eventos`);
      fonte.onmessage = () => recarregar();
      fonte.onerror = () => {}; // EventSource reconecta sozinho
    }

    const intervalo = ehNativo() ? 8000 : 15000;
    const timer = setInterval(() => {
      if (!document.hidden) recarregar();
    }, intervalo);

    const aoMudarVisibilidade = () => {
      if (!document.hidden) recarregar();
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);

    return () => {
      fonte?.close();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [recarregar]);
}
