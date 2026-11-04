import { useSyncExternalStore } from 'react';

// true enquanto a media query casar. Sem matchMedia (testes), devolve false.
export function useMediaQuery(consulta) {
  return useSyncExternalStore(
    (avisar) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(consulta);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(consulta).matches : false),
    () => false
  );
}
