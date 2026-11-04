// Selo de status: cor semântica, sentence case, 12px, nunca quebra linha.
const TONS = {
  ok: 'bg-ok-fundo text-ok',
  atencao: 'bg-atencao-fundo text-atencao',
  erro: 'bg-erro-fundo text-erro',
  neutro: 'bg-creme-escuro text-carvao-claro',
  escuro: 'bg-carvao text-rico-light',
};

export default function Selo({ tom = 'neutro', icone: Icone, className = '', children, ...resto }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${TONS[tom]} ${className}`}
      {...resto}
    >
      {Icone && <Icone size={13} aria-hidden="true" />}
      {children}
    </span>
  );
}
