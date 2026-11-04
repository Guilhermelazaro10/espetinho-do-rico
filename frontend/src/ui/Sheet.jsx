import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Painel: de baixo para cima no celular; no desktop (≥1024px) vira painel
// lateral (lado="direita") ou modal centralizado (lado="centro").
// Foco preso dentro, Esc fecha, foco volta para quem abriu.
const POSICAO_DESKTOP = {
  direita:
    'lg:inset-y-0 lg:right-0 lg:left-auto lg:bottom-auto lg:h-dvh lg:max-h-none lg:w-[420px] lg:rounded-none lg:rounded-l-3xl lg:animate-sheet-lateral',
  centro:
    'lg:inset-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[min(560px,calc(100vw-64px))] lg:max-h-[min(720px,calc(100dvh-64px))] lg:rounded-3xl lg:animate-sheet-centro',
};

export default function Sheet({ aberto, aoFechar, titulo, subtitulo, rodape, lado = 'direita', children }) {
  const painel = useRef(null);
  const idTitulo = useId();
  // Ref sempre com o aoFechar mais recente, sem reinstalar o foco a cada render
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement;
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco inicial no próprio painel: o leitor de tela anuncia o título e o
    // Tab segue para o conteúdo. Focar o primeiro controle era perigoso — na
    // sacola ele é a lixeira, e um Enter sem querer tirava o item.
    painel.current?.focus({ preventScroll: true });

    const aoTeclar = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFecharRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !painel.current) return;
      const lista = [...painel.current.querySelectorAll(FOCAVEIS)].filter((el) => el.offsetParent !== null);
      if (!lista.length) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === painel.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAntes;
      if (anterior instanceof HTMLElement) anterior.focus({ preventScroll: true });
    };
  }, [aberto]);

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fundo-entra bg-carvao/50" onClick={aoFechar} aria-hidden="true" />
      <section
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-sheet-sobe flex-col rounded-t-3xl bg-creme text-carvao shadow-media outline-none ${POSICAO_DESKTOP[lado]}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-rico-wood/25 px-4 pt-3 pb-3 sm:px-6">
          <div className="min-w-0 pt-2">
            <h2 id={idTitulo} className="text-xl font-bold text-carvao">
              {titulo}
            </h2>
            {subtitulo && <p className="mt-0.5 text-rotulo font-medium text-carvao-suave">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-carvao-suave hover:bg-carvao/6"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div data-sheet-conteudo className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {children}
        </div>
        {rodape && (
          <footer className="shrink-0 border-t border-rico-wood/25 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:px-6">
            {rodape}
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
}
