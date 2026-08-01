import {
  Ban, Banknote, CheckCircle2, Clock, CreditCard, MapPin, Phone, Printer, QrCode,
} from 'lucide-react';
import { moeda } from '../lib/api';
import { desdeMin } from '../lib/datas';
import { TIPOS_PEDIDO } from '../lib/constantes';

/*
 * Cards da tela Delivery/Balcão:
 *  - PendenteCard: pedido online aguardando Aceitar/Recusar.
 *  - PedidoCard: pedido em andamento (avançar, pagar, cancelar, reimprimir).
 */

const STATUS_ROTULO = {
  aberto: 'Aberto',
  em_preparo: 'Em preparo',
  entregue: 'Entregue',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const ROTULO_PAGAMENTO = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };

// Telefone -> link de WhatsApp (DDI 55) / endereço -> Google Maps.
export const linkWhats = (tel) => `https://wa.me/55${String(tel || '').replace(/\D/g, '')}`;
export const linkMapa = (end) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end || '')}`;

function ContatoCliente({ pedido }) {
  return (
    <>
      {pedido.clienteTelefone && (
        <a
          href={linkWhats(pedido.clienteTelefone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
        >
          <Phone size={11} /> {pedido.clienteTelefone}
        </a>
      )}
      {pedido.clienteEndereco && (
        <a
          href={linkMapa(pedido.clienteEndereco)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-start gap-1 text-xs font-semibold text-sky-700 underline-offset-2 hover:underline"
        >
          <MapPin size={11} className="mt-0.5 shrink-0" /> {pedido.clienteEndereco}
        </a>
      )}
    </>
  );
}

function LinhaPagamentoPretendido({ pedido, className }) {
  if (!pedido.pagamentoPretendido) return null;
  const rotulo = ROTULO_PAGAMENTO[pedido.pagamentoPretendido] ?? pedido.pagamentoPretendido;
  return (
    <p className={className}>
      Pagamento: {rotulo}
      {pedido.pagamentoPretendido === 'dinheiro' && pedido.trocoPara > 0
        ? ` · troco p/ ${moeda(pedido.trocoPara)}`
        : ''}
    </p>
  );
}

export function PendenteCard({ pedido, onAceitar, onRecusar }) {
  return (
    <article className="rounded-xl border border-emerald-200 bg-white p-3 shadow-suave">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg text-carvao">
            #{pedido.id} · {pedido.tipo === TIPOS_PEDIDO.DELIVERY ? 'Entrega' : 'Retirada'}
          </p>
          <p className="truncate text-sm font-bold text-carvao-claro">{pedido.clienteNome}</p>
          <ContatoCliente pedido={pedido} />
        </div>
        <strong className="shrink-0 text-rico-red">{moeda(pedido.total)}</strong>
      </div>
      {pedido.agendadoPara && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700">
          <Clock size={12} /> Agendado: {pedido.agendadoPara}
        </p>
      )}
      <ul className="mt-2 space-y-0.5 text-sm text-carvao-claro">
        {pedido.itens?.map((it) => (
          <li key={it.id}>
            {it.quantidade}x {it.produto?.nome}
            {it.observacao && <em className="text-carvao-suave"> — {it.observacao}</em>}
          </li>
        ))}
      </ul>
      <LinhaPagamentoPretendido pedido={pedido} className="mt-1 text-xs font-bold text-carvao" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => onAceitar(pedido)}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white shadow-suave transition hover:bg-emerald-800 active:scale-[0.98]"
        >
          <CheckCircle2 size={16} /> Aceitar
        </button>
        <button
          onClick={() => onRecusar(pedido)}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-rico-red ring-1 ring-rico-red/40 transition active:scale-[0.98]"
        >
          <Ban size={16} /> Recusar
        </button>
      </div>
    </article>
  );
}

export function PedidoCard({ pedido, gerente, agora, onAvancar, onPagar, onCancelar, onReimprimir }) {
  const podeAvancar = ['aberto', 'em_preparo'].includes(pedido.status);
  return (
    <article className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10 transition hover:-translate-y-0.5 hover:shadow-media">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl text-carvao">
            #{pedido.id}
            {pedido.origem === 'online' && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                Online
              </span>
            )}
          </p>
          <p className="truncate text-sm font-bold text-carvao-claro">
            {pedido.clienteNome}
            {pedido.criadoPor && pedido.criadoPor !== 'Online' && (
              <span className="font-semibold text-carvao-suave"> · por {pedido.criadoPor}</span>
            )}
          </p>
          <ContatoCliente pedido={pedido} />
          {pedido.agendadoPara && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-700">
              <Clock size={12} /> Agendado: {pedido.agendadoPara}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full bg-carvao/8 px-2.5 py-1 text-xs font-bold text-carvao-claro">
            {STATUS_ROTULO[pedido.status] ?? pedido.status}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-carvao-suave">
            <Clock size={11} /> {desdeMin(pedido.criadoEm, agora)}
          </span>
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-carvao-claro">
        {pedido.itens?.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">
              {item.quantidade}x {item.produto?.nome}
              {item.observacao && <em className="text-carvao-suave"> — {item.observacao}</em>}
            </span>
            <strong>{moeda(item.precoUnitario * item.quantidade)}</strong>
          </li>
        ))}
      </ul>
      <LinhaPagamentoPretendido pedido={pedido} className="mt-2 text-xs font-bold text-carvao" />
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-carvao/10 pt-3">
        <strong className="text-lg text-rico-red">{moeda(pedido.total)}</strong>
        <div className="flex flex-wrap justify-end gap-2">
          {podeAvancar && (
            <button onClick={() => onAvancar(pedido)} className="flex min-h-10 items-center gap-1 rounded-lg bg-carvao px-3.5 py-2 text-xs font-bold text-rico-light transition hover:bg-carvao-claro active:scale-95">
              <CheckCircle2 size={14} /> Avancar
            </button>
          )}
          <button
            onClick={() => onReimprimir(pedido)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-carvao-claro transition hover:bg-carvao/10 hover:text-carvao"
            aria-label="Reimprimir comanda"
            title="Reimprimir"
          >
            <Printer size={16} />
          </button>
          {gerente && pedido.status === 'entregue' && (
            <>
              <button onClick={() => onPagar(pedido, 'pix')} className="flex min-h-10 items-center gap-1 rounded-lg bg-rico-red px-3.5 py-2 text-xs font-bold text-rico-light transition hover:bg-vinho-profundo active:scale-95" title="Pagar com Pix">
                <QrCode size={14} /> Pix
              </button>
              <button onClick={() => onPagar(pedido, 'dinheiro')} className="flex min-h-10 items-center gap-1 rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-carvao ring-1 ring-rico-wood/35 transition hover:ring-rico-red/40 active:scale-95" title="Pagar em dinheiro">
                <Banknote size={14} /> Dinheiro
              </button>
              <button onClick={() => onPagar(pedido, 'cartao')} className="flex min-h-10 items-center gap-1 rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-carvao ring-1 ring-rico-wood/35 transition hover:ring-rico-red/40 active:scale-95" title="Pagar no cartão">
                <CreditCard size={14} /> Cartao
              </button>
            </>
          )}
          {gerente && (
            <button onClick={() => onCancelar(pedido)} className="flex h-10 w-10 items-center justify-center rounded-lg text-rico-red transition hover:bg-rico-red/10" aria-label="Cancelar">
              <Ban size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
