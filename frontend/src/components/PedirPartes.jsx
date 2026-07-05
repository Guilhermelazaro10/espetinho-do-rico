import { useEffect, useState } from 'react';
import {
  Plus, Minus, Trash2, X, ShoppingBag, Loader2, CheckCircle2,
  Clock, Ban, ClipboardList, User,
} from 'lucide-react';
import { api, moeda } from '../lib/api';
import { dataLoja } from '../lib/datas';

/*
 * Partes do cardápio online (/cardapio): topo da loja, navegação inferior,
 * "Meus pedidos" com acompanhamento, perfil salvo no aparelho e a sacola.
 * A página Pedir.jsx orquestra; aqui ficam os blocos de tela.
 */

const SITUACAO = {
  pendente: { texto: 'Recebido — aguardando a loja confirmar', cor: 'amber' },
  aberto: { texto: 'Confirmado! Seu pedido está em preparo', cor: 'sky' },
  em_preparo: { texto: 'Seu pedido está em preparo', cor: 'sky' },
  pago: { texto: 'Pedido concluído. Obrigado!', cor: 'emerald' },
  cancelado: { texto: 'Pedido recusado/cancelado pela loja', cor: 'red' },
};

export function situacaoDe(status, tipo) {
  if (status === 'entregue') {
    return { texto: tipo === 'DELIVERY' ? 'Saiu para entrega!' : 'Pronto para retirada!', cor: 'emerald' };
  }
  return SITUACAO[status] ?? { texto: 'Acompanhando seu pedido…', cor: 'amber' };
}

export const VISUAL_SIT = {
  amber: { bg: 'bg-amber-100', tx: 'text-amber-600', Icone: Clock },
  sky: { bg: 'bg-sky-100', tx: 'text-sky-600', Icone: Loader2 },
  emerald: { bg: 'bg-emerald-100', tx: 'text-emerald-600', Icone: CheckCircle2 },
  red: { bg: 'bg-rico-red/10', tx: 'text-rico-red', Icone: Ban },
};

export function TopoLoja({ loja }) {
  return (
    <header className="sticky top-0 z-20 border-b border-rico-wood/25 bg-rico-light/95 backdrop-blur">
      <div className="h-1 w-full bg-brasa-gradiente" />
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
        <img src="/logo_clean.png" alt={loja?.nome} className="h-12 w-auto shrink-0" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl leading-tight text-rico-dark">{loja?.nome}</p>
          {loja?.endereco && <p className="truncate text-[11px] font-semibold text-carvao-suave">{loja.endereco}</p>}
        </div>
      </div>
    </header>
  );
}

export function BottomNav({ vista, setVista, qtdPedidos }) {
  const itens = [
    { id: 'cardapio', rotulo: 'Cardápio', Icone: ShoppingBag },
    { id: 'pedidos', rotulo: 'Pedidos', Icone: ClipboardList, badge: qtdPedidos },
    { id: 'perfil', rotulo: 'Perfil', Icone: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-rico-wood/25 bg-rico-light/97 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {itens.map(({ id, rotulo, Icone, badge }) => (
        <button
          key={id}
          onClick={() => setVista(id)}
          className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-extrabold transition ${
            vista === id ? 'text-rico-red' : 'text-carvao-suave'
          }`}
        >
          <Icone size={22} strokeWidth={vista === id ? 2.7 : 2} />
          {rotulo}
          {badge > 0 && (
            <span className="absolute right-1/4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rico-red px-1 text-[9px] font-bold text-white">
              {badge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export function MeusPedidos({ lista, onIrAoCardapio }) {
  const [mapa, setMapa] = useState({});
  useEffect(() => {
    if (lista.length === 0) return undefined;
    let vivo = true;
    const buscar = async () => {
      const ids = lista.slice(0, 15).map((p) => p.id);
      const res = await Promise.all(
        ids.map((id) => api.publico.statusPedido(id).then((s) => [id, s]).catch(() => [id, null]))
      );
      if (vivo) setMapa(Object.fromEntries(res));
    };
    buscar();
    const t = setInterval(buscar, 20000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [lista]);

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
      <h1 className="mb-4 font-display text-2xl text-rico-dark">Meus pedidos</h1>
      {lista.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-rico-wood/15">
          <ClipboardList size={32} className="mx-auto text-carvao-suave" />
          <p className="mt-3 text-sm font-semibold text-carvao-suave">Você ainda não fez pedidos por aqui.</p>
          <button onClick={onIrAoCardapio} className="mt-4 rounded-xl bg-rico-red px-5 py-2.5 font-extrabold text-rico-light shadow-brasa">
            Ver cardápio
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => {
            const st = mapa[p.id];
            const s = st ? situacaoDe(st.status, st.tipo) : null;
            const vis = s ? VISUAL_SIT[s.cor] : VISUAL_SIT.amber;
            return (
              <li key={p.id} className="rounded-2xl bg-white p-4 shadow-suave ring-1 ring-rico-wood/15">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold text-carvao">Pedido #{p.id}</p>
                  <span className="text-xs font-semibold text-carvao-suave">
                    {dataLoja(p.criadoEm)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-carvao-suave">
                  {p.tipo === 'DELIVERY' ? 'Entrega' : 'Retirada'} · {moeda(p.total)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${vis.bg} ${vis.tx}`}>
                    <vis.Icone size={14} className={s?.cor === 'sky' ? 'animate-spin' : ''} />
                  </span>
                  <span className="text-sm font-bold text-carvao">{s ? s.texto : 'Atualizando…'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

export function Perfil({ form, set, aoSalvar }) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
      <div className="flex flex-col items-center gap-2 py-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rico-red/10 text-rico-red">
          <User size={32} />
        </span>
        <h1 className="font-display text-2xl text-rico-dark">Seu perfil</h1>
        <p className="max-w-xs text-center text-sm font-semibold text-carvao-suave">
          Salve seus dados pra agilizar os próximos pedidos. Fica só neste aparelho.
        </p>
      </div>
      <div className="space-y-3">
        <Campo rotulo="Nome" valor={form.nome} aoMudar={(v) => set('nome', v)} placeholder="Seu nome" />
        <Campo rotulo="WhatsApp" valor={form.telefone} aoMudar={(v) => set('telefone', v)} placeholder="(88) 9 0000-0000" inputMode="tel" />
        <Campo rotulo="Endereço (entrega)" valor={form.endereco} aoMudar={(v) => set('endereco', v)} placeholder="Rua, número, referência" textarea />
      </div>
      <button
        onClick={aoSalvar}
        className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-rico-red text-base font-extrabold text-rico-light shadow-brasa transition active:scale-[0.98]"
      >
        <CheckCircle2 size={18} /> Salvar
      </button>
    </main>
  );
}

export function Campo({ rotulo, valor, aoMudar, placeholder, inputMode, textarea }) {
  const comum = 'mt-1 w-full rounded-2xl bg-white px-4 py-3 text-base font-semibold text-carvao outline-none ring-1 ring-rico-wood/25 placeholder:text-carvao/35 focus:ring-rico-red';
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wider text-carvao-suave">{rotulo}</span>
      {textarea ? (
        <textarea value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} rows={2} maxLength={200} className={comum} />
      ) : (
        <input value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={80} className={comum} />
      )}
    </label>
  );
}

export function Sacola({ fechar, linhas, total, totalItens, mudarQtd, mudarObs }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/45" role="dialog" aria-modal="true">
      <button className="absolute inset-0 h-full w-full cursor-default" onClick={fechar} aria-label="Fechar" />
      <section className="relative max-h-[82dvh] w-full rounded-t-[1.6rem] bg-rico-light text-carvao shadow-flutuante">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-[1.6rem] border-b border-rico-wood/25 bg-rico-light px-4 py-4">
          <h2 className="font-display text-2xl text-rico-dark">{totalItens} {totalItens === 1 ? 'item' : 'itens'} · {moeda(total)}</h2>
          <button onClick={fechar} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-carvao/8 active:scale-95" aria-label="Fechar">
            <X size={22} />
          </button>
        </header>
        <div className="mx-auto max-h-[64dvh] max-w-md overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ul className="space-y-3">
            {linhas.map((l, i) => (
              <li key={`${l.produto.id}-${i}`} className="rounded-2xl bg-white p-3 shadow-suave ring-1 ring-rico-wood/15">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-base font-extrabold text-carvao">{l.produto.nome}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => mudarQtd(i, -1)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-carvao/8 active:scale-95" aria-label="Diminuir">
                      {l.quantidade === 1 ? <Trash2 size={19} /> : <Minus size={19} />}
                    </button>
                    <span className="w-7 text-center text-xl font-extrabold">{l.quantidade}</span>
                    <button onClick={() => mudarQtd(i, 1)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rico-red text-rico-light shadow-brasa active:scale-95" aria-label="Aumentar">
                      <Plus size={19} />
                    </button>
                  </div>
                </div>
                <input value={l.observacao} onChange={(e) => mudarObs(i, e.target.value)} placeholder="Observação: sem cebola, bem passado..." maxLength={120} className="mt-3 min-h-11 w-full rounded-2xl bg-creme px-4 text-base font-semibold text-carvao outline-none ring-1 ring-rico-wood/25 placeholder:text-carvao/35 focus:ring-rico-red" />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-carvao-suave">Subtotal</span>
                  <span className="text-base font-extrabold text-rico-red">{moeda(l.produto.preco * l.quantidade)}</span>
                </div>
              </li>
            ))}
          </ul>
          <button onClick={fechar} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-carvao font-extrabold text-rico-light active:scale-[0.98]">
            <CheckCircle2 size={20} /> Continuar escolhendo
          </button>
        </div>
      </section>
    </div>
  );
}
