import {
  Ban, Banknote, BellRing, CheckCircle2, Clock, CreditCard, MapPin, Phone, Printer, QrCode,
} from 'lucide-react';
import { moeda } from '../lib/api';
import { desdeMin } from '../lib/datas';
import { TIPOS_PEDIDO } from '../lib/constantes';
import Selo from '../ui/Selo';

/*
 * Cards da tela Delivery/Balcão:
 *  - FaixaPendente: pedido online aguardando Aceitar/Recusar.
 *  - PedidoCard: pedido em andamento (avançar, pagar, cancelar, reimprimir).
 */

const STATUS = {
  aberto: { rotulo: 'Aberto', tom: 'neutro' },
  em_preparo: { rotulo: 'Em preparo', tom: 'atencao' },
  entregue: { rotulo: 'Entregue', tom: 'ok' },
  pago: { rotulo: 'Pago', tom: 'ok' },
  cancelado: { rotulo: 'Cancelado', tom: 'erro' },
};

const ROTULO_PAGAMENTO = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };

export const rotuloTipo = (pedido) =>
  pedido.pagoAntecipado ? 'Venda rápida' : pedido.tipo === TIPOS_PEDIDO.DELIVERY ? 'Entrega' : 'Balcão';

// Telefone -> link de WhatsApp (DDI 55) / endereço -> Google Maps.
export const linkWhats = (tel) => `https://wa.me/55${String(tel || '').replace(/\D/g, '')}`;
export const linkMapa = (end) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(end || '')}`;

// Links com área de toque de 44px por padding — a fonte não cresce.
function ContatoCliente({ pedido }) {
  if (!pedido.clienteTelefone && !pedido.clienteEndereco) return null;
  return (
    <div className="-my-1 flex flex-col items-start">
      {pedido.clienteTelefone && (
        <a
          href={linkWhats(pedido.clienteTelefone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-rotulo font-semibold text-ok underline-offset-4 hover:underline lg:min-h-8"
        >
          <Phone size={14} aria-hidden="true" /> {pedido.clienteTelefone}
        </a>
      )}
      {pedido.clienteEndereco && (
        <a
          href={linkMapa(pedido.clienteEndereco)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-start gap-1.5 py-2.5 text-rotulo font-semibold text-carvao-claro underline underline-offset-4 decoration-rico-wood/60 hover:decoration-carvao lg:min-h-8 lg:py-1"
        >
          <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-rico-red" />
          <span className="min-w-0 break-words">{pedido.clienteEndereco}</span>
        </a>
      )}
    </div>
  );
}

function textoPagamento(pedido) {
  if (!pedido.pagamentoPretendido) return null;
  const rotulo = ROTULO_PAGAMENTO[pedido.pagamentoPretendido] ?? pedido.pagamentoPretendido;
  const troco =
    pedido.pagamentoPretendido === 'dinheiro' && pedido.trocoPara > 0 ? ` · troco p/ ${moeda(pedido.trocoPara)}` : '';
  return `${rotulo}${troco}`;
}

function resumoItens(pedido) {
  return (pedido.itens ?? []).map((it) => `${it.quantidade}x ${it.produto?.nome ?? ''}`).join(', ');
}

// Pedido online pendente: uma faixa, não uma caixa. Aceitar e Recusar sempre
// à mão, com 44px.
export function FaixaPendente({ pedido, onAceitar, onRecusar }) {
  const entrega = pedido.tipo === TIPOS_PEDIDO.DELIVERY;
  const pagamento = textoPagamento(pedido);
  return (
    <article className="animate-chegada-online flex flex-col gap-3 rounded-xl border border-ok-borda bg-ok-fundo p-3 pl-4 sm:flex-row sm:items-center">
      <BellRing size={20} aria-hidden="true" className="hidden shrink-0 text-ok sm:block" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ok-escuro">
          Novo pedido online #{pedido.id} · {pedido.clienteNome}
        </p>
        <p className="mt-0.5 text-rotulo font-medium text-ok-escuro/90 tabular-nums">
          {entrega ? 'Entrega' : 'Retirada'} · {moeda(pedido.total)}
          {pagamento ? ` · ${pagamento}` : ''}
        </p>
        {/* Resumo corrido dos itens (não é a lista de produtos): 2 linhas no celular */}
        <p className="mt-1 line-clamp-2 text-rotulo text-carvao sm:line-clamp-none">{resumoItens(pedido)}</p>
        {pedido.itens?.some((it) => it.observacao) && (
          <p className="hidden text-rotulo italic text-carvao-suave sm:block">
            {pedido.itens
              .filter((it) => it.observacao)
              .map((it) => `${it.produto?.nome}: ${it.observacao}`)
              .join(' · ')}
          </p>
        )}
        {pedido.agendadoPara && (
          <Selo tom="atencao" icone={Clock} className="mt-1.5">
            Agendado: {pedido.agendadoPara}
          </Selo>
        )}
        <div className="hidden sm:block">
          <ContatoCliente pedido={pedido} />
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          onClick={() => onRecusar(pedido)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-rico-red ring-1 ring-inset ring-rico-red/40 transition-colors hover:bg-erro-fundo"
        >
          <Ban size={16} aria-hidden="true" /> Recusar
        </button>
        <button
          type="button"
          onClick={() => onAceitar(pedido)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ok px-4 text-sm font-semibold text-white transition-colors hover:bg-ok-escuro"
        >
          <CheckCircle2 size={16} aria-hidden="true" /> Aceitar
        </button>
      </div>
    </article>
  );
}

export function PedidoCard({ pedido, gerente, agora, onAvancar, onPagar, onCancelar, onReimprimir }) {
  const podeAvancar = ['aberto', 'em_preparo'].includes(pedido.status);
  const podePagar = gerente && pedido.status === 'entregue';
  const status = STATUS[pedido.status] ?? { rotulo: pedido.status, tom: 'neutro' };
  const pagamento = textoPagamento(pedido);
  const icone = 'grid h-11 w-11 shrink-0 place-items-center rounded-lg transition-colors';
  return (
    <article className="animate-card-entrada rounded-2xl border border-rico-wood/30 bg-white p-4 shadow-suave">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-display text-xl leading-none text-carvao">#{pedido.id}</p>
            <Selo tom="neutro">{rotuloTipo(pedido)}</Selo>
            {pedido.origem === 'online' && <Selo tom="ok">Online</Selo>}
          </div>
          <p className="mt-1.5 text-sm font-semibold text-carvao">
            {pedido.clienteNome ?? (pedido.pagoAntecipado ? 'Venda rápida' : 'Sem nome')}
            {pedido.criadoPor && pedido.criadoPor !== 'Online' && (
              <span className="font-normal text-carvao-suave"> · por {pedido.criadoPor}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Selo tom={status.tom}>{status.rotulo}</Selo>
          <span className="flex items-center gap-1 text-xs font-medium text-carvao-suave">
            <Clock size={12} aria-hidden="true" /> {desdeMin(pedido.criadoEm, agora)}
          </span>
        </div>
      </div>

      <ContatoCliente pedido={pedido} />
      {pedido.agendadoPara && (
        <Selo tom="atencao" icone={Clock} className="mt-2">
          Agendado: {pedido.agendadoPara}
        </Selo>
      )}

      <ul className="mt-3 space-y-1 text-sm text-carvao">
        {pedido.itens?.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span data-nome-produto className="min-w-0">
              <span className="font-semibold tabular-nums">{item.quantidade}x</span> {item.produto?.nome}
              {item.observacao && <em className="block text-rotulo text-carvao-suave">{item.observacao}</em>}
            </span>
            <span className="shrink-0 tabular-nums">{moeda(item.precoUnitario * item.quantidade)}</span>
          </li>
        ))}
      </ul>

      {pedido.pagoAntecipado ? (
        <Selo tom="ok" icone={CheckCircle2} className="mt-2">
          Pago no {ROTULO_PAGAMENTO[pedido.formaPagamento] ?? pedido.formaPagamento}
        </Selo>
      ) : (
        pagamento && <p className="mt-2 text-rotulo font-semibold text-carvao-claro">Pagamento: {pagamento}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-creme-escuro pt-3">
        <strong className="text-lg text-carvao tabular-nums">{moeda(pedido.total)}</strong>
        <div className="flex items-center gap-1">
          {podeAvancar && (
            <button
              type="button"
              onClick={() => onAvancar(pedido)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-carvao px-4 text-sm font-semibold text-creme transition-colors hover:bg-carvao-claro"
            >
              <CheckCircle2 size={16} aria-hidden="true" /> Avançar
            </button>
          )}
          <button
            type="button"
            onClick={() => onReimprimir(pedido)}
            className={`${icone} text-carvao-claro hover:bg-carvao/6 hover:text-carvao`}
            aria-label={`Reimprimir comanda do pedido #${pedido.id}`}
            title="Reimprimir comanda"
          >
            <Printer size={18} aria-hidden="true" />
          </button>
          {gerente && (
            <button
              type="button"
              onClick={() => onCancelar(pedido)}
              className={`${icone} text-rico-red hover:bg-erro-fundo`}
              aria-label={`Cancelar pedido #${pedido.id}`}
              title="Cancelar pedido"
            >
              <Ban size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {podePagar && (
        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={`Receber pedido #${pedido.id}`}>
          <button
            type="button"
            onClick={() => onPagar(pedido, 'pix')}
            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-rico-red px-2 text-sm font-semibold text-white hover:bg-vinho-profundo"
          >
            <QrCode size={16} aria-hidden="true" /> Pix
          </button>
          <button
            type="button"
            onClick={() => onPagar(pedido, 'dinheiro')}
            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-white px-2 text-sm font-semibold text-carvao ring-1 ring-inset ring-rico-wood/45 hover:bg-creme-escuro"
          >
            <Banknote size={16} aria-hidden="true" /> Dinheiro
          </button>
          <button
            type="button"
            onClick={() => onPagar(pedido, 'cartao')}
            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-white px-2 text-sm font-semibold text-carvao ring-1 ring-inset ring-rico-wood/45 hover:bg-creme-escuro"
          >
            <CreditCard size={16} aria-hidden="true" /> Cartão
          </button>
        </div>
      )}
    </article>
  );
}
