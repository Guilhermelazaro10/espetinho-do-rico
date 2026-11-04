import { useEffect, useState } from 'react';
import {
  Plus, Minus, Trash2, ShoppingBag, Loader2, CheckCircle2, Clock, Ban, ClipboardList, User,
  Bike, MapPin, MessageCircle, Store, ChevronDown, ExternalLink,
} from 'lucide-react';
import { api, moeda } from '../lib/api';
import { dataLoja } from '../lib/datas';
import CampoBase from '../ui/Campo';
import { plural } from '../lib/plural';

/*
 * Partes do cardápio online (/cardapio): topo de marca, navegação, linhas de
 * produto, sacola, "Meus pedidos", perfil. A página Pedir.jsx orquestra; aqui
 * ficam os blocos de tela.
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
  amber: { bg: 'bg-atencao-fundo', tx: 'text-atencao', Icone: Clock },
  sky: { bg: 'bg-creme-escuro', tx: 'text-carvao', Icone: Loader2 },
  emerald: { bg: 'bg-ok-fundo', tx: 'text-ok', Icone: CheckCircle2 },
  red: { bg: 'bg-erro-fundo', tx: 'text-erro', Icone: Ban },
};

// "Ter a Sáb, 17:00 às 02:00" -> "02:00" (o servidor manda o horário pronto;
// aqui só se extrai o fechamento para o status "aberto até").
export function horaFechamento(horario) {
  const m = /(\d{1,2}:\d{2})\s*às\s*(\d{1,2}:\d{2})\s*$/.exec(horario || '');
  return m ? m[2] : null;
}

const linkMapa = (endereco) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

const NAV = [
  { id: 'cardapio', rotulo: 'Cardápio', Icone: ShoppingBag },
  { id: 'pedidos', rotulo: 'Meus pedidos', curto: 'Pedidos', Icone: ClipboardList },
  { id: 'perfil', rotulo: 'Perfil', Icone: User },
];

/* ---------------- topo de marca ---------------- */

// O único elemento memorável da página: faixa carvão-profundo, logo, status
// ao vivo e o brilho de brasa atrás do logo. Nada mais na página leva efeito.
export function TopoLoja({ loja, vista, setVista, qtdPedidos }) {
  const [verEndereco, setVerEndereco] = useState(false);
  if (!loja) return null;
  const aberto = loja.aberto !== false;
  const fecha = horaFechamento(loja.horario);
  const bairros = loja.bairros ?? [];
  const menorTaxa = bairros.length ? Math.min(...bairros.map((b) => b.taxa)) : null;
  const deliveryPausado = loja.delivery === false;

  const status = aberto
    ? `Aberto agora${fecha ? ` · até ${fecha}` : ''}`
    : `Fechado${loja.proximaAbertura ? ` · abre ${loja.proximaAbertura}` : ''}`;

  const chip =
    'inline-flex min-h-9 items-center gap-2 rounded-full border border-rico-light/12 bg-rico-light/8 px-3 text-rotulo font-medium text-rico-light/85';
  const chipAcao = `${chip} min-h-11 transition-colors hover:bg-rico-light/14`;

  return (
    <header className="relative overflow-hidden bg-carvao-profundo text-rico-light">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-24 h-[300px] w-[340px] bg-[radial-gradient(closest-side,rgb(226_110_46/0.42),rgb(179_42_42/0.18)_55%,transparent)] lg:left-[calc(50%-620px)]"
      />
      <div className="relative mx-auto w-full max-w-[1120px] px-4 pb-5 pt-[calc(env(safe-area-inset-top,0px)+18px)] sm:px-6 lg:flex lg:items-center lg:gap-6 lg:py-7">
        <div className="flex items-center gap-4 lg:min-w-0 lg:flex-1 lg:gap-6">
          <img
            src="/logo_clean.png"
            alt="Espetinho do Rico"
            width="845"
            height="466"
            className="h-auto w-[104px] shrink-0 lg:w-[150px]"
          />
          <div className="min-w-0">
            <h1 className="font-display text-2xl leading-tight text-white lg:whitespace-nowrap lg:text-3xl xl:text-4xl">{loja.nome}</h1>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-rico-light/90" role="status">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${aberto ? 'bg-ok-claro shadow-[0_0_0_4px_rgb(122_211_166/0.18)]' : 'bg-brasa-clara'}`}
              />
              {status}
            </p>
          </div>
        </div>

        {/* Celular: uma linha curta de informação + duas ações */}
        <p className="mt-4 flex items-center gap-2 text-rotulo font-medium text-rico-light/85 lg:hidden">
          {deliveryPausado ? (
            <Store size={16} aria-hidden="true" className="shrink-0 text-brasa-clara" />
          ) : (
            <Bike size={16} aria-hidden="true" className="shrink-0 text-brasa-clara" />
          )}
          {textoEntrega(deliveryPausado, menorTaxa)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
          {loja.endereco && (
            <button
              type="button"
              className={chipAcao}
              aria-expanded={verEndereco}
              onClick={() => setVerEndereco((v) => !v)}
            >
              <MapPin size={16} aria-hidden="true" className="text-brasa-clara" /> Ver endereço
              <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${verEndereco ? 'rotate-180' : ''}`} />
            </button>
          )}
          {loja.whatsapp && (
            <a className={chipAcao} href={`https://wa.me/${loja.whatsapp}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={16} aria-hidden="true" className="text-brasa-clara" /> WhatsApp
            </a>
          )}
        </div>
        {verEndereco && loja.endereco && (
          <div className="mt-3 rounded-xl border border-rico-light/12 bg-rico-light/6 p-3 lg:hidden">
            <p className="text-sm text-rico-light/90">{loja.endereco}</p>
            <a
              className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brasa-clara underline underline-offset-4"
              href={linkMapa(loja.endereco)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir no Google Maps <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        )}

        {/* Desktop: informações em linha e a navegação vira links no topo */}
        <div className="hidden lg:flex lg:max-w-[540px] lg:shrink-0 lg:flex-col lg:items-end lg:gap-3">
          <nav aria-label="Navegação do cardápio" className="flex gap-1.5">
            {NAV.map(({ id, rotulo }) => (
              <button
                key={id}
                type="button"
                onClick={() => setVista(id)}
                aria-current={vista === id ? 'page' : undefined}
                className={`relative inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors ${
                  vista === id
                    ? 'border-rico-light bg-rico-light text-carvao'
                    : 'border-rico-light/14 bg-rico-light/8 text-rico-light/90 hover:bg-rico-light/14'
                }`}
              >
                {rotulo}
                {id === 'pedidos' && qtdPedidos > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rico-red px-1.5 text-xs font-bold text-white">
                    {qtdPedidos}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex flex-wrap justify-end gap-2">
            <InfoEntrega deliveryPausado={deliveryPausado} menorTaxa={menorTaxa} className={chip} />
            {loja.endereco && (
              <a className={chipAcao} href={linkMapa(loja.endereco)} target="_blank" rel="noopener noreferrer">
                <MapPin size={16} aria-hidden="true" className="text-brasa-clara" />
                {loja.endereco}
              </a>
            )}
            {loja.whatsapp && (
              <a className={chipAcao} href={`https://wa.me/${loja.whatsapp}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} aria-hidden="true" className="text-brasa-clara" /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function textoEntrega(deliveryPausado, menorTaxa) {
  if (deliveryPausado) return 'Só retirada hoje';
  return `${menorTaxa != null ? `Entrega a partir de ${moeda(menorTaxa)}` : 'Entrega'} · retirada no local`;
}

function InfoEntrega({ deliveryPausado, menorTaxa, className }) {
  const Icone = deliveryPausado ? Store : Bike;
  return (
    <span className={className}>
      <Icone size={16} aria-hidden="true" className="text-brasa-clara" />
      {textoEntrega(deliveryPausado, menorTaxa)}
    </span>
  );
}

/* ---------------- navegação inferior (celular) ---------------- */

export function BottomNav({ vista, setVista, qtdPedidos }) {
  return (
    <nav
      aria-label="Navegação do cardápio"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-rico-wood/30 bg-creme pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV.map(({ id, rotulo, curto, Icone }) => (
        <button
          key={id}
          type="button"
          onClick={() => setVista(id)}
          aria-current={vista === id ? 'page' : undefined}
          className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
            vista === id ? 'text-rico-red' : 'text-carvao-suave'
          }`}
        >
          <Icone size={22} strokeWidth={vista === id ? 2.4 : 2} aria-hidden="true" />
          {curto ?? rotulo}
          {id === 'pedidos' && qtdPedidos > 0 && (
            <span className="absolute left-1/2 top-1.5 ml-2 grid h-5 min-w-5 place-items-center rounded-full bg-rico-red px-1 text-xs font-bold text-white">
              {qtdPedidos}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

/* ---------------- produto e quantidade ---------------- */

// Controle "− 2 +" na própria linha. Com 1, o "−" vira lixeira.
export function Stepper({ quantidade, aoMenos, aoMais, nome }) {
  return (
    <div className="flex h-11 shrink-0 items-center rounded-lg bg-creme-escuro">
      <button
        type="button"
        onClick={aoMenos}
        aria-label={quantidade === 1 ? `Tirar ${nome} da sacola` : `Diminuir ${nome}`}
        className="grid h-11 w-11 place-items-center rounded-lg text-carvao transition-colors hover:bg-carvao/6"
      >
        {quantidade === 1 ? <Trash2 size={18} aria-hidden="true" /> : <Minus size={18} aria-hidden="true" />}
      </button>
      <span className="w-7 text-center text-base font-bold tabular-nums" aria-live="polite">
        {quantidade}
      </span>
      <button
        type="button"
        onClick={aoMais}
        aria-label={`Mais um ${nome}`}
        className="grid h-11 w-11 place-items-center rounded-lg bg-rico-red text-white transition-colors hover:bg-vinho-profundo"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

export function LinhaProduto({ produto, quantidade, aoAdicionar, aoRemover }) {
  return (
    <li
      className={`flex min-h-[72px] items-center gap-3.5 py-3 pl-4 pr-3 transition-colors ${
        quantidade > 0 ? 'bg-rico-wood/8' : ''
      }`}
    >
      {/* Espaço da foto já previsto no layout (Fase 3). Sem foto, a linha fica
          só com texto — sem imagem falsa nem placeholder. */}
      {produto.imagem && (
        <img
          src={produto.imagem}
          alt=""
          width="88"
          height="88"
          loading="lazy"
          className="h-[88px] w-[88px] shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p data-nome-produto className="line-clamp-2 text-base font-semibold leading-snug text-carvao">
          {produto.nome}
        </p>
        <p className="mt-0.5 text-sm font-bold text-rico-red tabular-nums">{moeda(produto.preco)}</p>
      </div>
      {quantidade > 0 ? (
        <Stepper quantidade={quantidade} aoMenos={aoRemover} aoMais={aoAdicionar} nome={produto.nome} />
      ) : (
        <button
          type="button"
          onClick={aoAdicionar}
          aria-label={`Adicionar ${produto.nome}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-rico-red text-white transition-[background-color,transform] hover:bg-vinho-profundo active:scale-95"
        >
          <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

// Esqueleto com o formato real da página (topo, chips e linhas)
export function EsqueletoCardapio() {
  return (
    <div className="min-h-dvh bg-creme" aria-busy="true" aria-label="Carregando o cardápio">
      <div className="bg-carvao-profundo px-4 pb-6 pt-6">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4">
          <div className="h-14 w-[104px] rounded-xl bg-rico-light/10" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-48 max-w-full rounded bg-rico-light/12" />
            <div className="h-4 w-32 rounded bg-rico-light/10" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1120px] animate-pulse px-4 pt-4 sm:px-6">
        <div className="flex gap-2">
          {[96, 112, 84].map((w) => (
            <div key={w} className="h-11 rounded-full bg-creme-escuro" style={{ width: w }} />
          ))}
        </div>
        <div className="mt-6 h-6 w-36 rounded bg-creme-escuro" />
        <div className="mt-3 overflow-hidden rounded-2xl border border-rico-wood/30 bg-white lg:max-w-[720px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 border-t border-creme-escuro px-4 py-4 first:border-t-0">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-creme-escuro" />
                <div className="h-3.5 w-16 rounded bg-creme-escuro" />
              </div>
              <div className="h-11 w-11 rounded-lg bg-creme-escuro" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- sacola ---------------- */

export function ItensSacola({ linhas, mudarQtd, mudarObs }) {
  return (
    <ul className="divide-y divide-creme-escuro">
      {linhas.map((l, i) => (
        <li key={`${l.produto.id}-${i}`} className="py-3 first:pt-0">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p data-nome-produto className="line-clamp-2 text-sm font-semibold leading-snug text-carvao">
                {l.produto.nome}
              </p>
              <p className="text-rotulo font-medium text-carvao-suave tabular-nums">
                {moeda(l.produto.preco * l.quantidade)}
              </p>
            </div>
            <Stepper
              quantidade={l.quantidade}
              aoMenos={() => mudarQtd(i, -1)}
              aoMais={() => mudarQtd(i, 1)}
              nome={l.produto.nome}
            />
          </div>
          <label className="sr-only" htmlFor={`obs-${l.produto.id}-${i}`}>
            Observação para {l.produto.nome}
          </label>
          <input
            id={`obs-${l.produto.id}-${i}`}
            value={l.observacao}
            onChange={(e) => mudarObs(i, e.target.value)}
            placeholder="Observação: sem cebola, bem passado…"
            maxLength={120}
            className="mt-2 min-h-11 w-full rounded-lg bg-white px-3 text-sm text-carvao outline-none ring-1 ring-inset ring-rico-wood/45 focus:ring-2 focus:ring-rico-red"
          />
        </li>
      ))}
    </ul>
  );
}

// Itens / entrega / total, sempre com algarismos tabulares
export function ResumoValores({ subtotal, taxa, rotuloEntrega, total, escuro = false }) {
  const tom = escuro ? 'text-rico-light/75' : 'text-carvao-suave';
  return (
    <dl className="space-y-1.5 text-sm tabular-nums">
      <div className={`flex justify-between gap-3 ${tom}`}>
        <dt>Itens</dt>
        <dd>{moeda(subtotal)}</dd>
      </div>
      {rotuloEntrega !== null && (
        <div className={`flex justify-between gap-3 ${tom}`}>
          <dt>Entrega</dt>
          <dd>{taxa > 0 ? moeda(taxa) : rotuloEntrega}</dd>
        </div>
      )}
      <div className={`flex justify-between gap-3 pt-1.5 text-lg font-bold ${escuro ? 'text-white' : 'text-carvao'}`}>
        <dt>Total</dt>
        <dd>{moeda(total)}</dd>
      </div>
    </dl>
  );
}

// Celular: uma barra só. "3 · Ver sacola · R$ 24,00"
export function BarraSacola({ totalItens, subtotal, aoAbrir }) {
  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+76px)] z-30 lg:hidden">
      <button
        type="button"
        onClick={aoAbrir}
        className="flex h-[58px] w-full items-center gap-3 rounded-2xl bg-rico-red px-4 text-white shadow-media transition-transform active:scale-[0.99]"
        aria-label={`Ver sacola: ${plural(totalItens, 'item', 'itens')}, ${moeda(subtotal)}`}
      >
        <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-white/18 px-1.5 text-sm font-bold tabular-nums">
          {totalItens}
        </span>
        <span className="flex-1 text-left text-base font-bold">Ver sacola</span>
        <span className="text-base font-bold tabular-nums">{moeda(subtotal)}</span>
      </button>
    </div>
  );
}

/* ---------------- meus pedidos e perfil ---------------- */

export function MeusPedidos({ lista, onIrAoCardapio }) {
  const [mapa, setMapa] = useState({});
  useEffect(() => {
    if (lista.length === 0) return undefined;
    let vivo = true;
    const buscar = async () => {
      // Pedido salvo antes do código de acompanhamento não tem como ser
      // consultado (a rota por ID saiu): fica na lista, sem status ao vivo.
      const comCodigo = lista.slice(0, 15).filter((p) => p.codigo);
      const res = await Promise.all(
        comCodigo.map((p) => api.publico.acompanhar(p.codigo).then((s) => [p.id, s]).catch(() => [p.id, null]))
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
    <main className="mx-auto w-full max-w-[720px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
      <h2 className="mb-4 font-display text-2xl text-carvao">Meus pedidos</h2>
      {lista.length === 0 ? (
        <div className="rounded-2xl border border-rico-wood/30 bg-white p-8 text-center">
          <ClipboardList size={32} className="mx-auto text-carvao-suave" aria-hidden="true" />
          <p className="mt-3 text-sm text-carvao-suave">Você ainda não fez pedidos por aqui.</p>
          <button
            type="button"
            onClick={onIrAoCardapio}
            className="mt-4 min-h-11 rounded-lg bg-rico-red px-5 text-sm font-semibold text-white hover:bg-vinho-profundo"
          >
            Ver cardápio
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-creme-escuro overflow-hidden rounded-2xl border border-rico-wood/30 bg-white">
          {lista.map((p) => {
            const st = mapa[p.id];
            const s = st ? situacaoDe(st.status, st.tipo) : null;
            const vis = s ? VISUAL_SIT[s.cor] : VISUAL_SIT.amber;
            return (
              <li key={p.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-carvao">Pedido #{p.id}</p>
                  <span className="text-rotulo text-carvao-suave">{dataLoja(p.criadoEm)}</span>
                </div>
                <p className="text-sm text-carvao-suave tabular-nums">
                  {p.tipo === 'DELIVERY' ? 'Entrega' : 'Retirada'} · {moeda(p.total)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${vis.bg} ${vis.tx}`}>
                    <vis.Icone size={14} aria-hidden="true" className={s?.cor === 'sky' ? 'animate-spin' : ''} />
                  </span>
                  <span className="text-sm font-semibold text-carvao">
                    {s ? s.texto : p.codigo ? 'Atualizando…' : 'Status indisponível (pedido antigo)'}
                  </span>
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
    <main className="mx-auto w-full max-w-[480px] px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
      <h2 className="font-display text-2xl text-carvao">Seu perfil</h2>
      <p className="mt-1 text-sm text-carvao-suave">
        Salve seus dados para agilizar os próximos pedidos. Fica só neste aparelho.
      </p>
      <div className="mt-5 space-y-4">
        <Campo rotulo="Nome" valor={form.nome} aoMudar={(v) => set('nome', v)} placeholder="Seu nome" autoComplete="name" />
        <Campo
          rotulo="WhatsApp"
          valor={form.telefone}
          aoMudar={(v) => set('telefone', v)}
          placeholder="(88) 9 0000-0000"
          inputMode="tel"
          type="tel"
          autoComplete="tel"
        />
        <Campo
          rotulo="Endereço (entrega)"
          valor={form.endereco}
          aoMudar={(v) => set('endereco', v)}
          placeholder="Rua, número, referência"
          autoComplete="street-address"
          textarea
        />
      </div>
      <button
        type="button"
        onClick={aoSalvar}
        className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-rico-red text-base font-semibold text-white hover:bg-vinho-profundo"
      >
        <CheckCircle2 size={18} aria-hidden="true" /> Salvar
      </button>
    </main>
  );
}

export function Campo({ rotulo, valor, aoMudar, placeholder, inputMode, textarea, ...resto }) {
  return (
    <CampoBase
      rotulo={rotulo}
      como={textarea ? 'textarea' : 'input'}
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={textarea ? 200 : 80}
      {...resto}
    />
  );
}
