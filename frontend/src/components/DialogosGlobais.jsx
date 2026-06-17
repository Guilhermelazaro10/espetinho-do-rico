import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { _registrarHost } from '../lib/dialogos';

/*
 * Host único dos diálogos (confirmação / entrada de texto). Montado uma vez na
 * raiz (main.jsx). Resolve a Promise aberta por confirmar()/pedirTexto().
 */
export default function DialogosGlobais() {
  const [estado, setEstado] = useState(null); // { opcoes, resolver }
  const [texto, setTexto] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    _registrarHost(
      (opcoes) =>
        new Promise((resolver) => {
          setTexto(opcoes.valorInicial ?? '');
          setEstado({ opcoes, resolver });
        })
    );
    return () => _registrarHost(null);
  }, []);

  const finalizar = useCallback(
    (valor) => {
      estado?.resolver(valor);
      setEstado(null);
    },
    [estado]
  );

  const ehTexto = estado?.opcoes.tipo === 'texto';

  const confirmar = useCallback(() => {
    if (ehTexto) {
      if (estado.opcoes.obrigatorio && !texto.trim()) return;
      finalizar(texto.trim());
    } else {
      finalizar(true);
    }
  }, [ehTexto, estado, texto, finalizar]);

  const cancelar = useCallback(() => finalizar(ehTexto ? null : false), [ehTexto, finalizar]);

  useEffect(() => {
    if (!estado) return;
    if (ehTexto) inputRef.current?.focus();
    const aoTeclar = (e) => {
      if (e.key === 'Escape') cancelar();
      else if (e.key === 'Enter' && !ehTexto) confirmar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [estado, ehTexto, cancelar, confirmar]);

  if (!estado) return null;
  const { opcoes } = estado;
  const Icone = ehTexto ? MessageSquare : AlertTriangle;
  const perigo = Boolean(opcoes.perigo);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-carvao/45 p-5 backdrop-blur-sm"
      onClick={cancelar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={opcoes.titulo ?? 'Confirmação'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-flutuante"
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              perigo ? 'bg-rico-red/10 text-rico-red' : 'bg-rico-wood/15 text-rico-dark'
            }`}
          >
            <Icone size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl text-carvao">{opcoes.titulo ?? 'Confirmar'}</h2>
            {opcoes.mensagem && (
              <p className="mt-1 text-sm text-carvao-suave">{opcoes.mensagem}</p>
            )}
          </div>
        </div>

        {ehTexto && (
          <div className="px-6 pt-4">
            <input
              ref={inputRef}
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmar()}
              placeholder={opcoes.placeholder ?? ''}
              maxLength={opcoes.maxLength ?? 200}
              className="w-full rounded-xl border border-rico-wood/35 bg-rico-light px-4 py-3 text-sm font-semibold text-carvao outline-none focus:border-rico-red"
            />
          </div>
        )}

        <div className="mt-6 flex gap-2 bg-creme/50 px-6 py-4">
          <button
            onClick={cancelar}
            className="flex-1 rounded-xl bg-carvao/8 py-3 text-sm font-bold text-carvao-claro transition hover:bg-carvao/15"
          >
            {opcoes.cancelarRotulo ?? 'Cancelar'}
          </button>
          <button
            onClick={confirmar}
            className={`flex-1 rounded-xl py-3 text-sm font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0 ${
              perigo ? 'bg-rico-red hover:bg-vinho-profundo' : 'bg-rico-red hover:bg-vinho-profundo'
            }`}
          >
            {opcoes.confirmarRotulo ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
