// Ação do cabeçalho do PDV. No celular vira só o ícone (44x44, rótulo no
// aria-label e no title); a partir de `sm` mostra ícone + rótulo.
const VARIANTES = {
  neutra: 'bg-white text-carvao ring-1 ring-inset ring-rico-wood/45 hover:bg-creme-escuro',
  escura: 'bg-carvao text-creme hover:bg-carvao-claro',
  marca: 'bg-rico-red text-white hover:bg-vinho-profundo',
  atencao: 'bg-atencao text-white hover:bg-atencao-escuro',
};

export default function AcaoTopo({
  icone: Icone,
  rotulo,
  variante = 'neutra',
  girando = false,
  sempreRotulo = false,
  className = '',
  ...resto
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-creme-escuro disabled:text-carvao-suave disabled:ring-0 ${
        sempreRotulo ? 'px-3' : 'sm:px-3'
      } ${VARIANTES[variante]} ${className}`}
      {...resto}
    >
      <Icone size={18} aria-hidden="true" className={`shrink-0 ${girando ? 'animate-spin' : ''}`} />
      <span className={sempreRotulo ? 'whitespace-nowrap' : 'hidden whitespace-nowrap sm:inline'}>{rotulo}</span>
    </button>
  );
}
