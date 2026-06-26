import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Minus, Trash2, ShoppingCart, ChevronRight, X, ArrowLeft, Search,
  Bike, ShoppingBag, Loader2, CheckCircle2, MessageCircle, AlertTriangle, RefreshCw,
  Clock, QrCode, CreditCard, Banknote,
} from 'lucide-react';
import { api, moeda, paraCentavos } from '../lib/api';

/*
 * Cardápio online (público, sem login). Cliente monta o pedido e finaliza:
 * cai na aba Delivery do PDV (/api/publico/pedidos) e abre o WhatsApp da loja
 * com o resumo. Acesse por /cardapio (ou #/pedir).
 */
const CHAVE_CLIENTE = 'pedir.cliente'; // lembra nome/telefone/endereço no aparelho

const PAGAMENTOS = [
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
];

export default function Pedir() {
  const [loja, setLoja] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState(null);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [comandaAberta, setComandaAberta] = useState(false);
  const [etapa, setEtapa] = useState('cardapio'); // cardapio | checkout | sucesso
  const [tipo, setTipo] = useState('DELIVERY'); // DELIVERY | BALCAO
  const [form, setForm] = useState({ nome: '', telefone: '', endereco: '', bairro: '', pagamento: '', troco: '' });
  const [erroCheckout, setErroCheckout] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoFeito, setPedidoFeito] = useState(null);

  // Lembra os dados do cliente entre visitas
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_CLIENTE));
      if (salvo) setForm((f) => ({ ...f, ...salvo }));
    } catch { /* ignora */ }
  }, []);

  function carregar() {
    setCarregando(true);
    setErroCarga(false);
    api.publico
      .cardapio()
      .then((d) => {
        setLoja(d.loja);
        setCategorias(d.categorias);
        setCategoria((c) => c ?? d.categorias[0]?.nome ?? null);
      })
      .catch(() => setErroCarga(true))
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  const itens = useMemo(() => {
    const grupo = categorias.find((c) => c.nome === categoria);
    const lista = grupo?.itens ?? [];
    const termo = busca.trim().toLowerCase();
    return termo ? lista.filter((i) => i.nome.toLowerCase().includes(termo)) : lista;
  }, [categorias, categoria, busca]);

  const qtdPorProduto = useMemo(() => {
    const m = {};
    for (const l of carrinho) m[l.produto.id] = (m[l.produto.id] || 0) + l.quantidade;
    return m;
  }, [carrinho]);

  const subtotal = carrinho.reduce((s, l) => s + l.produto.preco * l.quantidade, 0);
  const totalItens = carrinho.reduce((s, l) => s + l.quantidade, 0);

  const bairros = useMemo(() => loja?.bairros ?? [], [loja]);
  const taxa = useMemo(() => {
    if (tipo !== 'DELIVERY' || !form.bairro) return 0;
    return bairros.find((b) => b.nome === form.bairro)?.taxa ?? 0;
  }, [tipo, form.bairro, bairros]);
  const totalFinal = subtotal + taxa;

  function adicionar(produto) {
    setCarrinho((ls) => {
      const i = ls.findIndex((l) => l.produto.id === produto.id && !l.observacao);
      if (i >= 0) {
        const n = [...ls];
        n[i] = { ...n[i], quantidade: n[i].quantidade + 1 };
        return n;
      }
      return [...ls, { produto, quantidade: 1, observacao: '' }];
    });
    if (navigator.vibrate) navigator.vibrate(15);
  }
  const mudarQtd = (i, d) =>
    setCarrinho((ls) =>
      ls.map((l, j) => (j === i ? { ...l, quantidade: l.quantidade + d } : l)).filter((l) => l.quantidade > 0)
    );
  const mudarObs = (i, obs) =>
    setCarrinho((ls) => ls.map((l, j) => (j === i ? { ...l, observacao: obs } : l)));

  function validar() {
    if (form.nome.trim().length < 2) return 'Informe seu nome.';
    if (!form.pagamento) return 'Escolha a forma de pagamento.';
    if (tipo === 'DELIVERY') {
      if (form.telefone.replace(/\D/g, '').length < 8) return 'Informe um telefone com DDD.';
      if (form.endereco.trim().length < 5) return 'Informe o endereço de entrega.';
      if (bairros.length && !form.bairro) return 'Escolha o bairro de entrega.';
    }
    return '';
  }

  async function finalizar() {
    const err = validar();
    if (err) return setErroCheckout(err);
    setErroCheckout('');
    setEnviando(true);

    const trocoPara =
      form.pagamento === 'dinheiro' && form.troco.trim() ? paraCentavos(form.troco) : undefined;
    const corpo = {
      tipo,
      clienteNome: form.nome.trim(),
      clienteTelefone: form.telefone.trim() || undefined,
      pagamentoPretendido: form.pagamento,
      trocoPara,
      ...(tipo === 'DELIVERY' ? { clienteEndereco: form.endereco.trim(), bairro: form.bairro || undefined } : {}),
      itens: carrinho.map((l) => ({
        produtoId: l.produto.id,
        quantidade: l.quantidade,
        observacao: l.observacao.trim() || undefined,
      })),
    };
    try {
      const pedido = await api.publico.pedir(corpo);
      try {
        localStorage.setItem(
          CHAVE_CLIENTE,
          JSON.stringify({ nome: form.nome.trim(), telefone: form.telefone.trim(), endereco: form.endereco.trim(), bairro: form.bairro })
        );
      } catch { /* ignora */ }
      setPedidoFeito(pedido);
      setEtapa('sucesso');
    } catch (e) {
      setErroCheckout(e.message);
    } finally {
      setEnviando(false);
    }
  }

  function linkWhatsApp() {
    if (!loja?.whatsapp || !pedidoFeito) return null;
    const linhasItens = pedidoFeito.itens
      .map((i) => `• ${i.quantidade}x ${i.nome}${i.observacao ? ` (${i.observacao})` : ''}`)
      .join('\n');
    const rotuloPg = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' }[form.pagamento] ?? form.pagamento;
    const pg =
      `\n\nPagamento: ${rotuloPg}` +
      (form.pagamento === 'dinheiro' && form.troco.trim() ? ` (troco p/ R$ ${form.troco})` : '');
    const entrega =
      pedidoFeito.tipo === 'DELIVERY'
        ? `\n\n*ENTREGA*\nNome: ${form.nome}\nTel: ${form.telefone}\nEndereço: ${form.endereco}${form.bairro ? ` — ${form.bairro}` : ''}`
        : `\n\n*RETIRADA NO LOCAL*\nNome: ${form.nome}`;
    const texto =
      `*Pedido #${pedidoFeito.id} — ${loja.nome}*\n\n${linhasItens}` +
      `\n\nTotal: ${moeda(pedidoFeito.total)}${pg}${entrega}`;
    return `https://wa.me/${loja.whatsapp}?text=${encodeURIComponent(texto)}`;
  }

  const set = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));

  /* ---------- estados de carga ---------- */
  if (carregando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-rico-light">
        <Loader2 size={30} className="animate-spin text-rico-red" />
      </div>
    );
  }
  if (erroCarga) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-rico-light px-6 text-center">
        <AlertTriangle size={36} className="text-rico-red" />
        <p className="font-bold text-carvao">Não foi possível carregar o cardápio.</p>
        <button onClick={carregar} className="flex items-center gap-2 rounded-xl bg-rico-red px-5 py-3 font-extrabold text-rico-light shadow-brasa">
          <RefreshCw size={18} /> Tentar de novo
        </button>
      </div>
    );
  }

  const fechada = loja && loja.aberto === false;

  /* ---------- tela de sucesso ---------- */
  if (etapa === 'sucesso') {
    const wpp = linkWhatsApp();
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-rico-light px-6 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={44} />
        </span>
        <div>
          <h1 className="font-display text-3xl text-rico-dark">Pedido recebido!</h1>
          <p className="mt-1 font-semibold text-carvao-suave">Pedido #{pedidoFeito.id} · {moeda(pedidoFeito.total)}</p>
        </div>
        {wpp ? (
          <>
            <p className="max-w-xs text-sm font-semibold text-carvao-suave">Toque abaixo para mandar a confirmação no WhatsApp da loja:</p>
            <a href={wpp} target="_blank" rel="noopener noreferrer" className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-extrabold text-white shadow-brasa active:scale-[0.98]">
              <MessageCircle size={22} /> Enviar no WhatsApp
            </a>
          </>
        ) : (
          <p className="max-w-xs text-sm font-semibold text-carvao-suave">Já recebemos seu pedido. Em breve a loja entra em contato.</p>
        )}
        <button
          onClick={() => {
            setCarrinho([]);
            setForm((f) => ({ ...f, troco: '' }));
            setPedidoFeito(null);
            setEtapa('cardapio');
          }}
          className="mt-2 text-sm font-bold text-rico-red underline"
        >
          Fazer outro pedido
        </button>
      </div>
    );
  }

  /* ---------- checkout ---------- */
  if (etapa === 'checkout') {
    return (
      <div className="min-h-dvh bg-rico-light text-carvao">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-rico-wood/25 bg-rico-light/95 px-4 py-4 backdrop-blur">
          <button onClick={() => setEtapa('cardapio')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-carvao/8 active:scale-95" aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-2xl text-rico-dark">Finalizar pedido</h1>
        </header>

        <main className="mx-auto w-full max-w-md px-4 py-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'DELIVERY', rotulo: 'Entrega', Icone: Bike },
              { id: 'BALCAO', rotulo: 'Retirada', Icone: ShoppingBag },
            ].map(({ id, rotulo, Icone }) => (
              <button key={id} onClick={() => setTipo(id)} className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-4 py-4 font-extrabold transition ${tipo === id ? 'border-rico-red bg-rico-red/8 text-rico-red' : 'border-rico-wood/25 bg-white text-carvao-suave'}`}>
                <Icone size={24} /> {rotulo}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <Campo rotulo="Seu nome" valor={form.nome} aoMudar={(v) => set('nome', v)} placeholder="Como te chamamos" />
            <Campo rotulo={tipo === 'DELIVERY' ? 'Telefone (WhatsApp)' : 'Telefone (opcional)'} valor={form.telefone} aoMudar={(v) => set('telefone', v)} placeholder="(88) 9 0000-0000" inputMode="tel" />
            {tipo === 'DELIVERY' && (
              <Campo rotulo="Endereço de entrega" valor={form.endereco} aoMudar={(v) => set('endereco', v)} placeholder="Rua, número, referência" textarea />
            )}
            {tipo === 'DELIVERY' && bairros.length > 0 && (
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-carvao-suave">Bairro</span>
                <select value={form.bairro} onChange={(e) => set('bairro', e.target.value)} className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-base font-semibold text-carvao outline-none ring-1 ring-rico-wood/25 focus:ring-rico-red">
                  <option value="">Selecione o bairro</option>
                  {bairros.map((b) => (
                    <option key={b.nome} value={b.nome}>{b.nome} — {moeda(b.taxa)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* forma de pagamento */}
          <div className="mt-5">
            <span className="text-xs font-bold uppercase tracking-wider text-carvao-suave">Forma de pagamento</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PAGAMENTOS.map(({ id, rotulo, Icone }) => (
                <button key={id} onClick={() => set('pagamento', id)} className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 text-sm font-extrabold transition ${form.pagamento === id ? 'border-rico-red bg-rico-red/8 text-rico-red' : 'border-rico-wood/25 bg-white text-carvao-suave'}`}>
                  <Icone size={20} /> {rotulo}
                </button>
              ))}
            </div>
            {form.pagamento === 'dinheiro' && (
              <div className="mt-3">
                <Campo rotulo="Troco para quanto? (opcional)" valor={form.troco} aoMudar={(v) => set('troco', v)} placeholder="ex.: 50,00" inputMode="decimal" />
              </div>
            )}
          </div>

          {tipo === 'DELIVERY' && bairros.length === 0 && (
            <p className="mt-3 text-xs font-semibold text-carvao-suave">A taxa de entrega é combinada com a loja na confirmação.</p>
          )}
          {erroCheckout && <p className="mt-4 rounded-xl bg-rico-red/10 px-4 py-3 text-sm font-bold text-rico-red">{erroCheckout}</p>}
        </main>

        <footer className="sticky bottom-0 border-t border-rico-wood/25 bg-rico-light/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            {tipo === 'DELIVERY' && taxa > 0 && (
              <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-carvao-suave">
                <span>Itens {moeda(subtotal)} + entrega {moeda(taxa)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-carvao-suave">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</p>
                <p className="font-display text-2xl text-rico-dark">{moeda(totalFinal)}</p>
              </div>
              <button onClick={finalizar} disabled={enviando || carrinho.length === 0} className="flex min-h-[58px] flex-1 items-center justify-center gap-2 rounded-2xl bg-rico-red text-lg font-extrabold text-rico-light shadow-brasa transition active:scale-[0.98] disabled:opacity-40">
                {enviando ? <><Loader2 size={22} className="animate-spin" /> Enviando</> : 'Confirmar pedido'}
              </button>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  /* ---------- cardápio ---------- */
  return (
    <div className="min-h-dvh bg-rico-light text-carvao">
      <header className="sticky top-0 z-20 border-b border-rico-wood/25 bg-rico-light/95 backdrop-blur">
        <div className="h-1 w-full bg-brasa-gradiente" />
        <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 py-3">
          <img src="/logo_clean.png" alt={loja?.nome} className="h-12 w-auto shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-display text-xl leading-tight text-rico-dark">{loja?.nome}</p>
            {loja?.endereco && <p className="truncate text-[11px] font-semibold text-carvao-suave">{loja.endereco}</p>}
          </div>
        </div>
        {fechada && (
          <div className="flex items-center justify-center gap-2 bg-rico-red px-4 py-2 text-sm font-extrabold text-rico-light">
            <Clock size={16} /> Fechado agora{loja.horario ? ` · ${loja.horario}` : ''}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-44 pt-4">
        <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-white px-4 ring-1 ring-rico-wood/25">
          <Search size={18} className="text-carvao-suave" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item" className="min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-carvao outline-none placeholder:text-carvao/40" />
        </label>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categorias.map((c) => (
            <button key={c.nome} onClick={() => setCategoria(c.nome)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-extrabold transition ${c.nome === categoria ? 'bg-rico-red text-rico-light shadow-brasa' : 'bg-white text-carvao-suave ring-1 ring-rico-wood/25'}`}>
              {c.nome}
            </button>
          ))}
        </div>

        <ul className="mt-4 space-y-3">
          {itens.map((produto) => {
            const qtd = qtdPorProduto[produto.id] || 0;
            return (
              <li key={produto.id}>
                <button onClick={() => adicionar(produto)} className={`flex min-h-[72px] w-full items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-left shadow-suave ring-1 transition active:scale-[0.98] ${qtd > 0 ? 'ring-rico-red/40' : 'ring-rico-wood/15'}`}>
                  <span className="min-w-0">
                    <span className="block text-base font-extrabold text-carvao">{produto.nome}</span>
                    <span className="mt-0.5 block text-sm font-bold text-rico-red">{moeda(produto.preco)}</span>
                  </span>
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rico-red text-rico-light shadow-brasa">
                    <Plus size={22} strokeWidth={2.7} />
                    {qtd > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rico-wood px-1 text-xs font-extrabold text-rico-dark ring-2 ring-rico-light">
                        {qtd}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
          {itens.length === 0 && (
            <li className="rounded-2xl bg-white px-4 py-8 text-center text-sm font-bold text-carvao-suave ring-1 ring-rico-wood/15">Nenhum item encontrado.</li>
          )}
        </ul>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-rico-wood/25 bg-rico-light/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={() => carrinho.length > 0 && setComandaAberta(true)} disabled={carrinho.length === 0} className="mb-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-left ring-1 ring-rico-wood/20 transition active:scale-[0.99] disabled:opacity-55">
            <span className="flex items-center gap-2 text-sm font-bold text-carvao-suave">
              <ShoppingCart size={18} className="text-rico-red" />
              {totalItens > 0 ? `${totalItens} ${totalItens === 1 ? 'item' : 'itens'} — toque p/ revisar` : 'Sua sacola está vazia'}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-base font-extrabold text-rico-red">
              {moeda(subtotal)}
              {carrinho.length > 0 && <ChevronRight size={17} className="text-carvao/35" />}
            </span>
          </button>
          <button onClick={() => setEtapa('checkout')} disabled={carrinho.length === 0 || fechada} className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-rico-red text-lg font-extrabold text-rico-light shadow-brasa transition active:scale-[0.98] disabled:opacity-40">
            {fechada ? 'Loja fechada no momento' : 'Avançar para a entrega'}
          </button>
        </div>
      </footer>

      {comandaAberta && (
        <Sacola fechar={() => setComandaAberta(false)} linhas={carrinho} total={subtotal} totalItens={totalItens} mudarQtd={mudarQtd} mudarObs={mudarObs} />
      )}
    </div>
  );
}

function Campo({ rotulo, valor, aoMudar, placeholder, inputMode, textarea }) {
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

function Sacola({ fechar, linhas, total, totalItens, mudarQtd, mudarObs }) {
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
