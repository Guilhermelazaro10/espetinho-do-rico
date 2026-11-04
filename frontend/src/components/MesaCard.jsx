import { Clock } from 'lucide-react';
import { moeda } from '../lib/api';
import { desdeMin } from '../lib/datas';
import { STATUS_MESA } from '../lib/constantes';

/*
 * Card de mesa do mapa do salão. O status aparece por cor de fundo + borda +
 * selo curto (o texto completo fica no aria-label e no title):
 *   Livre   → branco, borda madeira
 *   Ocupada → fundo e borda vinho
 *   Conta   → fundo e borda âmbar (conta solicitada/impressa)
 *
 * Faixas fixas: topo (selo), centro (número) e base (tempo e valor). O card
 * tem sempre a mesma altura e o número fica sempre no mesmo lugar, com ou sem
 * consumo — o olho acha a mesa pela posição.
 */
const ESTILOS = {
  [STATUS_MESA.LIVRE]: {
    card: 'border-rico-wood/40 bg-white hover:border-rico-wood',
    selo: 'bg-ok-fundo text-ok',
    curto: 'Livre',
    completo: 'Livre',
  },
  [STATUS_MESA.OCUPADA]: {
    card: 'border-rico-red bg-erro-fundo',
    selo: 'bg-white text-rico-red',
    curto: 'Ocupada',
    completo: 'Ocupada',
  },
  [STATUS_MESA.AGUARDANDO_PAGAMENTO]: {
    card: 'border-atencao bg-atencao-fundo',
    selo: 'bg-white text-atencao',
    curto: 'Conta',
    completo: 'Conta solicitada',
  },
};

// Valores antigos que ainda podem vir de bancos não migrados
const ESTILOS_LEGADOS = {
  livre: ESTILOS[STATUS_MESA.LIVRE],
  ocupada: ESTILOS[STATUS_MESA.OCUPADA],
  fechando: ESTILOS[STATUS_MESA.AGUARDANDO_PAGAMENTO],
};

export default function MesaCard({ mesa, total, desde, selecionada, aoClicar }) {
  const estilo = ESTILOS[mesa.status] ?? ESTILOS_LEGADOS[mesa.status] ?? ESTILOS[STATUS_MESA.LIVRE];
  const ocupada = estilo !== ESTILOS[STATUS_MESA.LIVRE];
  const numero = String(mesa.numero).padStart(2, '0');
  const rotulo = [
    `Mesa ${mesa.numero}`,
    estilo.completo,
    mesa.taxaAtiva ? 'taxa de serviço de 10%' : null,
    total > 0 ? moeda(total) : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={rotulo}
      aria-pressed={selecionada || undefined}
      title={estilo.completo}
      className={`grid h-[148px] w-full grid-rows-[24px_1fr_40px] rounded-2xl border-2 px-3 pb-2 pt-3 text-center shadow-suave transition-colors ${estilo.card} ${
        selecionada ? 'outline-3 outline-offset-2 outline-rico-red/40' : ''
      }`}
    >
      {/* Topo: selo curto (nunca quebra) e o 10% quando a taxa está ativa */}
      <span className="flex items-center justify-between gap-1">
        <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${estilo.selo}`}>
          {estilo.curto}
        </span>
        {mesa.taxaAtiva && (
          <span className="inline-flex h-6 items-center rounded-full border border-carvao/20 bg-white/70 px-2 text-xs font-bold text-carvao tabular-nums">
            10%
          </span>
        )}
      </span>

      {/* Centro: número sempre no mesmo lugar */}
      <span className="flex items-center justify-center font-display text-4xl leading-none text-carvao tabular-nums">
        {numero}
      </span>

      {/* Base: tempo e valor (vazia na mesa livre, mas ocupa o mesmo espaço) */}
      <span className="flex flex-col items-center justify-end gap-0.5 border-t border-carvao/10 pt-1">
        {ocupada && desde && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-carvao-suave">
            <Clock size={12} aria-hidden="true" /> {desdeMin(desde)}
          </span>
        )}
        {total > 0 && <span className="text-sm font-bold leading-none text-rico-red tabular-nums">{moeda(total)}</span>}
      </span>
    </button>
  );
}
