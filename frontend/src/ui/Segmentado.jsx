import { useLayoutEffect, useRef, useState } from 'react';

// Controle segmentado que NUNCA quebra linha: os itens dividem a largura
// igualmente. Quando um rótulo não cabe na sua fatia, todos passam para o
// rótulo curto (se houver) e, se nem assim couber, só o ícone — o rótulo
// completo fica no aria-label e no title.
//
// opcoes: [{ valor, rotulo, curto, icone, contador }]
export default function Segmentado({ opcoes, valor, aoMudar, rotulo, className = '' }) {
  const raiz = useRef(null);
  const reguaCompleta = useRef(null);
  const reguaCurta = useRef(null);
  const [nivel, setNivel] = useState('completo');
  const temIcones = opcoes.every((o) => o.icone);
  const temCurtos = opcoes.some((o) => o.curto);

  // Mede as réguas invisíveis (largura natural de cada rótulo) e compara com
  // a fatia de cada item. Medir cópias evita o vaivém de medir o próprio
  // controle já compactado.
  useLayoutEffect(() => {
    if (!raiz.current) return undefined;
    const avaliar = () => {
      const fatia = raiz.current.clientWidth / opcoes.length - 12; // padding + gap
      const maior = (regua) =>
        regua ? Math.max(0, ...[...regua.children].map((el) => el.scrollWidth)) : Infinity;
      if (fatia <= 0) return; // ainda sem layout (ou ambiente de teste)
      const completa = maior(reguaCompleta.current);
      if (completa <= fatia) setNivel('completo');
      // ícone (18px) + gap (8px) a menos: o rótulo inteiro ainda cabe sem o ícone
      else if (temIcones && completa - 26 <= fatia) setNivel('semIcone');
      else if (temCurtos && maior(reguaCurta.current) <= fatia) setNivel('curto');
      else setNivel(temIcones ? 'icone' : temCurtos ? 'curto' : 'completo');
    };
    avaliar();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(avaliar);
    ro.observe(raiz.current);
    return () => ro.disconnect();
  }, [opcoes, temIcones, temCurtos]);

  return (
    <div className={`relative min-w-0 ${className}`}>
      <div
        ref={raiz}
        role="group"
        aria-label={rotulo}
        className="grid gap-1 rounded-xl bg-creme-escuro p-1"
        style={{ gridTemplateColumns: `repeat(${opcoes.length}, minmax(0, 1fr))` }}
      >
        {opcoes.map(({ valor: v, rotulo: r, curto, icone: Icone, contador }) => {
          const ativo = v === valor;
          const reduzido = nivel === 'curto' || nivel === 'icone';
          const nomeAcessivel = contador ? `${r} (${contador})` : r;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={ativo}
              aria-label={reduzido ? nomeAcessivel : undefined}
              title={reduzido ? r : undefined}
              onClick={() => aoMudar(v)}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                ativo
                  ? 'bg-white text-carvao shadow-suave ring-1 ring-rico-wood/35'
                  : 'text-carvao-suave hover:bg-white/60'
              }`}
            >
              {Icone && (nivel === 'completo' || nivel === 'icone') && <Icone size={18} aria-hidden="true" className="shrink-0" />}
              {(nivel === 'completo' || nivel === 'semIcone') && <span className="truncate">{r}</span>}
              {nivel === 'curto' && <span className="truncate text-rotulo">{curto ?? r}</span>}
              {contador > 0 && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-rico-red px-1.5 text-xs font-bold text-white tabular-nums">
                  {contador}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <Regua ref={reguaCompleta} opcoes={opcoes} campo="rotulo" />
      {temCurtos && <Regua ref={reguaCurta} opcoes={opcoes} campo="curto" />}
    </div>
  );
}

// Régua invisível: mesmo conteúdo de cada item, em largura natural.
// O rótulo curto é medido em 13px, o mesmo tamanho em que ele aparece.
function Regua({ ref, opcoes, campo }) {
  return (
    <div ref={ref} aria-hidden="true" className="invisible absolute left-0 top-0 flex h-0 overflow-hidden">
      {opcoes.map((o) => (
        <span
          key={o.valor}
          className={`flex shrink-0 items-center gap-2 px-2 font-semibold whitespace-nowrap ${
            campo === 'curto' ? 'text-rotulo' : 'text-sm'
          }`}
        >
          {campo === 'rotulo' && o.icone && <span className="w-[18px]" />}
          {o[campo] ?? o.rotulo}
          {o.contador > 0 && <span className="min-w-5 px-1.5 text-xs">{o.contador}</span>}
        </span>
      ))}
    </div>
  );
}
