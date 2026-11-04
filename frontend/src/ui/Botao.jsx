import { LoaderCircle } from 'lucide-react';

// Botão base do PDV. Altura mínima de toque: md 44px, lg 52px.
const VARIANTES = {
  primario:
    'bg-rico-red text-white hover:bg-vinho-profundo active:bg-vinho-profundo shadow-suave',
  secundario:
    'bg-white text-carvao ring-1 ring-inset ring-rico-wood/45 hover:bg-creme-escuro active:bg-creme-escuro',
  fantasma: 'bg-transparent text-carvao hover:bg-carvao/6 active:bg-carvao/10',
  perigo:
    'bg-white text-rico-red ring-1 ring-inset ring-rico-red/40 hover:bg-erro-fundo active:bg-erro-fundo',
};

const TAMANHOS = {
  md: 'min-h-11 px-4 text-sm gap-2 rounded-lg',
  lg: 'min-h-13 px-5 text-base gap-2.5 rounded-lg',
};

// Desabilitado legível: carvao-suave sobre creme-escuro mede 4.84:1. Opacidade
// baixa (o padrão comum) deixava o texto ilegível e sem explicar o porquê.
const DESABILITADO =
  'disabled:bg-creme-escuro disabled:text-carvao-suave disabled:ring-0 disabled:shadow-none disabled:cursor-not-allowed';

export default function Botao({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  icone: Icone,
  type = 'button',
  className = '',
  disabled,
  children,
  ...resto
}) {
  const tamanhoIcone = tamanho === 'lg' ? 20 : 18;
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`inline-flex items-center justify-center font-semibold whitespace-nowrap transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:active:scale-100 ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${DESABILITADO} ${className}`}
      {...resto}
    >
      {carregando ? (
        <LoaderCircle size={tamanhoIcone} className="animate-spin" aria-hidden="true" />
      ) : (
        Icone && <Icone size={tamanhoIcone} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
