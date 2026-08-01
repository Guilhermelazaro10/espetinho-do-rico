import { Armchair, Clock, Flame, Receipt } from 'lucide-react';
import { moeda } from '../lib/api';
import { desdeMin } from '../lib/datas';
import { STATUS_MESA } from '../lib/constantes';

/*
 * Card de mesa do mapa do salão.
 * Linguagem de cores universal de salão:
 *   VERDE    → LIVRE
 *   VERMELHO → OCUPADA
 *   AMARELO  → AGUARDANDO_PAGAMENTO (conta solicitada/impressa)
 */
const ESTILOS = {
  [STATUS_MESA.LIVRE]: {
    borda: 'border-rico-wood/45 hover:border-emerald-500/70',
    fundo: 'bg-white/85',
    Icone: Armchair,
    icone: 'text-emerald-600',
    rotulo: 'Livre',
    chip: 'bg-emerald-100 text-emerald-700',
  },
  [STATUS_MESA.OCUPADA]: {
    borda: 'border-rico-red hover:border-rico-red',
    fundo: 'bg-rico-red/6',
    Icone: Flame,
    icone: 'text-rico-red',
    rotulo: 'Ocupada',
    chip: 'bg-rico-red/10 text-rico-red',
  },
  [STATUS_MESA.AGUARDANDO_PAGAMENTO]: {
    borda: 'border-rico-wood hover:border-rico-wood',
    fundo: 'bg-rico-wood/12',
    Icone: Receipt,
    icone: 'text-rico-wood',
    rotulo: 'Conta solicitada',
    chip: 'bg-rico-wood/20 text-rico-dark',
  },
};

const ESTILOS_LEGADOS = {
  livre: ESTILOS[STATUS_MESA.LIVRE],
  ocupada: {
    ...ESTILOS[STATUS_MESA.OCUPADA],
    borda: 'border-brasa hover:border-brasa-clara',
    fundo: 'bg-brasa/10',
    icone: 'text-brasa',
  },
  fechando: {
    ...ESTILOS[STATUS_MESA.AGUARDANDO_PAGAMENTO],
    borda: 'border-rico-red hover:border-vinho-profundo',
    fundo: 'bg-rico-red/5',
    icone: 'text-rico-red',
    rotulo: 'Aguardando conta',
    chip: 'bg-rico-red/10 text-rico-red',
  },
};

export default function MesaCard({ mesa, total, desde, selecionada, aoClicar }) {
  const estilo = ESTILOS[mesa.status] ?? ESTILOS_LEGADOS[mesa.status] ?? ESTILOS[STATUS_MESA.LIVRE];
  const { Icone } = estilo;
  const ocupada = mesa.status !== STATUS_MESA.LIVRE;

  return (
    <button
      onClick={aoClicar}
      aria-label={`Mesa ${mesa.numero}, ${estilo.rotulo}${total > 0 ? `, ${moeda(total)}` : ''}`}
      className={`group relative flex min-h-36 flex-col rounded-xl border p-4 text-center
        shadow-suave transition-all duration-200 hover:-translate-y-1 hover:shadow-media
        active:translate-y-0 ${estilo.borda} ${estilo.fundo}
        ${selecionada ? 'ring-2 ring-rico-red/35 ring-offset-2 ring-offset-rico-light' : ''}`}
    >
      <div className="flex w-full items-center justify-between">
        <Icone size={20} className={estilo.icone} strokeWidth={2.25} />
        <span className="rounded-full border border-rico-wood/35 bg-rico-light px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-rico-dark">
          {estilo.rotulo}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <span className="font-display text-5xl leading-none text-rico-dark">
          {String(mesa.numero).padStart(2, '0')}
        </span>
        {/* Há quanto tempo a mesa está com a comanda aberta — mesa esperando
            demais salta aos olhos no mapa sem precisar abrir a conta. */}
        {ocupada && desde && (
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-carvao-suave">
            <Clock size={11} /> {desdeMin(desde)}
          </span>
        )}
      </div>

      <span className="mt-auto h-5 w-full border-t border-rico-wood/25 pt-2 text-sm font-extrabold text-rico-red">
        {total > 0 ? moeda(total) : ''}
      </span>
    </button>
  );
}
