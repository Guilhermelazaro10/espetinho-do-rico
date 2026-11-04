import { useLayoutEffect, useRef, useState } from 'react';

// Controle segmentado que NUNCA quebra linha: os itens dividem a largura
// igualmente e, quando algum rótulo não cabe na sua fatia, todos passam a
// mostrar só o ícone (o rótulo fica no aria-label e no title).
//
// opcoes: [{ valor, rotulo, icone, contador }]
export default function Segmentado({ opcoes, valor, aoMudar, rotulo, className = '' }) {
  const raiz = useRef(null);
  const medidas = useRef(null);
  const [compacto, setCompacto] = useState(false);
  const todasTemIcone = opcoes.every((o) => o.icone);

  // Mede os rótulos numa cópia invisível em largura natural e compara com a
  // fatia de cada item. Medir a cópia evita o vaivém de medir o próprio
  // controle já compactado.
  useLayoutEffect(() => {
    if (!todasTemIcone || !raiz.current || !medidas.current) return undefined;
    const avaliar = () => {
      const fatia = raiz.current.clientWidth / opcoes.length - 12; // padding + gap
      const maior = Math.max(...[...medidas.current.children].map((el) => el.scrollWidth));
      setCompacto(maior > fatia);
    };
    avaliar();
    const ro = new ResizeObserver(avaliar);
    ro.observe(raiz.current);
    return () => ro.disconnect();
  }, [opcoes, todasTemIcone]);

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={raiz}
        role="group"
        aria-label={rotulo}
        className="grid gap-1 rounded-xl bg-creme-escuro p-1"
        style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
      >
        {opcoes.map(({ valor: v, rotulo: r, icone: Icone, contador }) => {
          const ativo = v === valor;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={ativo}
              aria-label={compacto ? (contador ? `${r} (${contador})` : r) : undefined}
              title={compacto ? r : undefined}
              onClick={() => aoMudar(v)}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                ativo
                  ? 'bg-white text-carvao shadow-suave ring-1 ring-rico-wood/35'
                  : 'text-carvao-claro hover:bg-white/60'
              }`}
            >
              {Icone && <Icone size={18} aria-hidden="true" className="shrink-0" />}
              {!compacto && <span className="truncate">{r}</span>}
              {contador > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rico-red px-1.5 text-xs font-bold text-white">
                  {contador}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Régua invisível: mesmo conteúdo de cada item, em largura natural */}
      <div ref={medidas} aria-hidden="true" className="invisible absolute left-0 top-0 flex h-0 overflow-hidden">
        {opcoes.map(({ valor: v, rotulo: r, contador }) => (
          <span key={v} className="flex shrink-0 items-center gap-2 px-2 text-sm font-semibold whitespace-nowrap">
            <span className="w-[18px]" />
            {r}
            {contador > 0 && <span className="min-w-5 px-1.5 text-xs">{contador}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
