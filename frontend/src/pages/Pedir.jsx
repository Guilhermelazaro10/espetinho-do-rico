import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Search, X, Bike, ShoppingBag, Loader2, CheckCircle2, MessageCircle, AlertTriangle,
  RefreshCw, Clock, QrCode, CreditCard, Banknote, MapPin, ChevronDown,
} from 'lucide-react';
import { api, moeda, paraCentavos } from '../lib/api';
import {
  situacaoDe, VISUAL_SIT, TopoLoja, BottomNav, MeusPedidos, Perfil, Campo, LinhaProduto,
  ItensSacola, ResumoValores, BarraSacola, EsqueletoCardapio,
} from '../components/PedirPartes';
import { plural } from '../lib/plural';
import Sheet from '../ui/Sheet';
import CampoBase from '../ui/Campo';

/*
 * Cardápio online (público, sem login). Cliente monta o pedido e finaliza:
 * cai na aba Delivery do PDV (/api/publico/pedidos) e abre o WhatsApp da loja
 * com o resumo. Acesse por /cardapio (ou #/pedir).
 */
const CHAVE_CLIENTE = 'pedir.cliente'; // lembra nome/telefone/endereço no aparelho
const CHAVE_PEDIDOS = 'pedir.pedidos'; // histórico de pedidos feitos NESTE aparelho

function carregarMeusPedidos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PEDIDOS)) || [];
  } catch {
    return [];
  }
}

const PAGAMENTOS = [
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
];

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const idSecao = (nome) => `cat-${nome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}`;

export default function Pedir() {
  const [loja, setLoja] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [busca, setBusca] = useState('');
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [ativa, setAtiva] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [sacolaAberta, setSacolaAberta] = useState(false);
  const [resumoAberto, setResumoAberto] = useState(false);
  const [etapa, setEtapa] = useState('cardapio'); // cardapio | checkout | sucesso | acompanhar
  const [tipo, setTipo] = useState('DELIVERY'); // DELIVERY | BALCAO
  const [form, setForm] = useState({ nome: '', telefone: '', endereco: '', bairro: '', pagamento: '', troco: '' });
  const [erros, setErros] = useState({});
  const [erroCheckout, setErroCheckout] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoFeito, setPedidoFeito] = useState(null);
  const [acomp, setAcomp] = useState(null);
  const [vista, setVista] = useState('cardapio'); // cardapio | pedidos | perfil
  const [meusPedidos, setMeusPedidos] = useState(carregarMeusPedidos);
  const secoesRef = useRef(new Map());
  const chipsRef = useRef(null);
  const campoBuscaRef = useRef(null);

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
        if (d.loja?.delivery === false) setTipo('BALCAO'); // delivery pausado: só retirada
        setCategorias(d.categorias);
      })
      .catch(() => setErroCarga(true))
      .finally(() => setCarregando(false));
  }
  useEffect(carregar, []);

  // Acompanhamento: enquanto estiver na tela de status, atualiza sozinho.
  useEffect(() => {
    if (etapa !== 'acompanhar' || !pedidoFeito?.codigo) return undefined;
    let vivo = true;
    const buscar = () =>
      api.publico
        .acompanhar(pedidoFeito.codigo)
        .then((s) => vivo && setAcomp(s))
        .catch(() => {});
    buscar();
    const t = setInterval(buscar, 15000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [etapa, pedidoFeito]);

  // Lista contínua: a busca filtra todas as categorias de uma vez
  const secoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return categorias
      .map((c) => ({ ...c, itens: termo ? c.itens.filter((i) => i.nome.toLowerCase().includes(termo)) : c.itens }))
      .filter((c) => c.itens.length > 0);
  }, [categorias, busca]);

  const naLista = etapa === 'cardapio' && vista === 'cardapio';

  // Scroll-spy: a categoria em leitura (a primeira que cruza a faixa logo
  // abaixo da barra fixa) fica destacada na barra de categorias.
  useEffect(() => {
    if (!naLista || !secoes.length) return undefined;
    const visiveis = new Map();
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) visiveis.set(e.target.dataset.categoria, e.isIntersecting);
        const primeira = secoes.find((s) => visiveis.get(s.nome));
        if (primeira) setAtiva(primeira.nome);
      },
      { rootMargin: '-84px 0px -55% 0px' }
    );
    for (const el of secoesRef.current.values()) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [secoes, naLista]);

  const categoriaAtiva = ativa && secoes.some((s) => s.nome === ativa) ? ativa : secoes[0]?.nome;

  // Mantém o chip ativo à vista dentro da barra (rola só a barra, nunca a página)
  useEffect(() => {
    const barra = chipsRef.current;
    const chip = barra?.querySelector(`[data-chip="${CSS.escape(categoriaAtiva ?? '')}"]`);
    if (!barra || !chip) return;
    const alvo = Math.max(0, chip.offsetLeft - 16);
    if (Math.abs(barra.scrollLeft - alvo) > 8) {
      barra.scrollTo({ left: alvo, behavior: reduzMovimento() ? 'auto' : 'smooth' });
    }
  }, [categoriaAtiva]);

  function irParaCategoria(nome) {
    setAtiva(nome);
    secoesRef.current
      .get(nome)
      ?.scrollIntoView({ behavior: reduzMovimento() ? 'auto' : 'smooth', block: 'start' });
  }

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

  // "−" na linha do cardápio: tira primeiro da linha sem observação
  function removerUm(produtoId) {
    setCarrinho((ls) => {
      let i = ls.findIndex((l) => l.produto.id === produtoId && !l.observacao);
      if (i < 0) for (let j = ls.length - 1; j >= 0; j--) if (ls[j].produto.id === produtoId) { i = j; break; }
      if (i < 0) return ls;
      return ls.map((l, j) => (j === i ? { ...l, quantidade: l.quantidade - 1 } : l)).filter((l) => l.quantidade > 0);
    });
  }

  // Erro de validação por campo (mostrado junto do campo) — mesmas regras de antes
  function errosDoForm() {
    const e = {};
    if (form.nome.trim().length < 2) e.nome = 'Informe seu nome.';
    if (tipo === 'DELIVERY') {
      if (form.telefone.replace(/\D/g, '').length < 8) e.telefone = 'Informe um telefone com DDD.';
      if (form.endereco.trim().length < 5) e.endereco = 'Informe o endereço de entrega.';
      if (bairros.length && !form.bairro) e.bairro = 'Escolha o bairro de entrega.';
    }
    if (!form.pagamento) e.pagamento = 'Escolha a forma de pagamento.';
    if (form.pagamento === 'dinheiro' && form.troco.trim() && paraCentavos(form.troco) < totalFinal) {
      e.troco = 'O troco deve ser maior ou igual ao total do pedido.';
    }
    return e;
  }

  async function finalizar() {
    const e = errosDoForm();
    setErros(e);
    const primeiro = Object.keys(e)[0];
    if (primeiro) {
      setErroCheckout(
        Object.keys(e).length === 1 ? e[primeiro] : 'Confira os campos destacados.'
      );
      document.getElementById(`campo-${primeiro}`)?.focus();
      return;
    }
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
      agendado: loja?.aberto === false, // loja fechada -> pedido agendado p/ próxima abertura
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
      const lista = [
        { id: pedido.id, codigo: pedido.codigo, total: pedido.total, tipo: pedido.tipo, criadoEm: Date.now() },
        ...carregarMeusPedidos(),
      ].slice(0, 30);
      try {
        localStorage.setItem(CHAVE_PEDIDOS, JSON.stringify(lista));
      } catch { /* ignora */ }
      setMeusPedidos(lista);
      setEtapa('sucesso');
    } catch (err) {
      setErroCheckout(err.message);
      // A loja pode ter pausado o delivery com esta página já aberta:
      // relê o estado para a tela mostrar só retirada, sem perder a sacola.
      api.publico
        .cardapio()
        .then((d) => {
          setLoja(d.loja);
          if (d.loja?.delivery === false) setTipo('BALCAO');
        })
        .catch(() => {});
    } finally {
      setEnviando(false);
    }
  }

  function salvarPerfil() {
    try {
      localStorage.setItem(
        CHAVE_CLIENTE,
        JSON.stringify({ nome: form.nome.trim(), telefone: form.telefone.trim(), endereco: form.endereco.trim(), bairro: form.bairro })
      );
    } catch { /* ignora */ }
    setVista('cardapio');
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

  const set = (campo, v) => {
    setForm((f) => ({ ...f, [campo]: v }));
    setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  function abrirCheckout() {
    setSacolaAberta(false);
    setEtapa('checkout');
    window.scrollTo(0, 0);
  }

  /* ---------- estados de carga ---------- */
  if (carregando) return <EsqueletoCardapio />;
  if (erroCarga) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-creme px-6 text-center">
        <AlertTriangle size={36} className="text-rico-red" aria-hidden="true" />
        <div>
          <p className="text-lg font-bold text-carvao">Não foi possível carregar o cardápio.</p>
          <p className="mt-1 text-sm text-carvao-suave">Confira a internet do aparelho e tente de novo.</p>
        </div>
        <button
          type="button"
          onClick={carregar}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-rico-red px-5 text-sm font-semibold text-white hover:bg-vinho-profundo"
        >
          <RefreshCw size={18} aria-hidden="true" /> Tentar de novo
        </button>
      </div>
    );
  }

  const fechada = loja && loja.aberto === false;
  const deliveryPausado = loja?.delivery === false;
  const rotuloCta = fechada ? (loja?.proximaAbertura ? 'Agendar pedido' : 'Loja fechada no momento') : 'Avançar para a entrega';
  const ctaBloqueado = fechada && !loja?.proximaAbertura;

  /* ---------- acompanhamento do pedido ---------- */
  if (etapa === 'acompanhar') {
    const s = acomp ? situacaoDe(acomp.status, acomp.tipo) : null;
    const vis = VISUAL_SIT[s?.cor] ?? VISUAL_SIT.amber;
    const Icone = vis.Icone;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-creme px-6 text-center">
        <p className="text-rotulo font-semibold text-carvao-suave">Pedido #{pedidoFeito.id}</p>
        <span className={`grid h-20 w-20 place-items-center rounded-full ${vis.bg} ${vis.tx}`}>
          <Icone size={42} aria-hidden="true" className={s?.cor === 'sky' ? 'animate-spin' : ''} />
        </span>
        <h1 className="max-w-sm text-2xl font-bold text-carvao" role="status">{s ? s.texto : 'Carregando…'}</h1>
        <p className="max-w-xs text-sm text-carvao-suave">Esta tela atualiza sozinha — pode deixar aberta.</p>
        <button
          type="button"
          onClick={() => setEtapa('sucesso')}
          className="min-h-11 rounded-lg px-4 text-sm font-semibold text-rico-red underline underline-offset-4"
        >
          Voltar
        </button>
      </div>
    );
  }

  /* ---------- pedido enviado ---------- */
  if (etapa === 'sucesso') {
    const wpp = linkWhatsApp();
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-creme px-6 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-full bg-ok-fundo text-ok">
          <CheckCircle2 size={44} aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-display text-3xl text-carvao">Pedido recebido!</h1>
          <p className="mt-1 text-sm font-semibold text-carvao-suave tabular-nums">
            Pedido #{pedidoFeito.id} · {moeda(pedidoFeito.total)}
          </p>
        </div>
        {wpp ? (
          <>
            <p className="max-w-xs text-sm text-carvao-suave">Toque abaixo para mandar a confirmação no WhatsApp da loja:</p>
            <a
              href={wpp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-13 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-ok px-5 text-base font-semibold text-white hover:bg-ok-escuro"
            >
              <MessageCircle size={20} aria-hidden="true" /> Enviar no WhatsApp
            </a>
          </>
        ) : (
          <p className="max-w-xs text-sm text-carvao-suave">Já recebemos seu pedido. Em breve a loja entra em contato.</p>
        )}
        <button
          type="button"
          onClick={() => setEtapa('acompanhar')}
          className="flex min-h-13 w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-white px-5 text-base font-semibold text-carvao ring-1 ring-inset ring-rico-wood/45 hover:bg-creme-escuro"
        >
          <Clock size={18} aria-hidden="true" /> Acompanhar meu pedido
        </button>
        <button
          type="button"
          onClick={() => {
            setCarrinho([]);
            setForm((f) => ({ ...f, troco: '' }));
            setPedidoFeito(null);
            setEtapa('cardapio');
          }}
          className="min-h-11 rounded-lg px-4 text-sm font-semibold text-rico-red underline underline-offset-4"
        >
          Fazer outro pedido
        </button>
      </div>
    );
  }

  /* ---------- checkout ---------- */
  if (etapa === 'checkout') {
    const rotuloEntrega =
      tipo === 'BALCAO'
        ? 'Grátis (retirada)'
        : bairros.length
          ? form.bairro ? moeda(taxa) : 'Escolha o bairro'
          : 'Combinada na confirmação';
    const listaResumo = (
      <ul className="space-y-2">
        {carrinho.map((l, i) => (
          <li key={`${l.produto.id}-${i}`} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 text-carvao">
              <span className="font-semibold tabular-nums">{l.quantidade}×</span> {l.produto.nome}
              {l.observacao.trim() && <span className="block text-rotulo text-carvao-suave">{l.observacao}</span>}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{moeda(l.produto.preco * l.quantidade)}</span>
          </li>
        ))}
      </ul>
    );
    const botaoConfirmar = (
      <button
        type="button"
        onClick={finalizar}
        disabled={enviando || carrinho.length === 0}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-rico-red px-4 text-base font-semibold text-white transition-colors hover:bg-vinho-profundo disabled:bg-creme-escuro disabled:text-carvao-suave"
      >
        {enviando ? (
          <>
            <Loader2 size={20} className="animate-spin" aria-hidden="true" /> Enviando
          </>
        ) : fechada ? 'Agendar pedido' : 'Confirmar pedido'}
      </button>
    );
    const opcao = (ativo) =>
      `flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition-colors ${
        ativo ? 'border-rico-red bg-erro-fundo text-rico-red' : 'border-rico-wood/35 bg-white text-carvao hover:border-rico-wood'
      }`;

    return (
      <div className="min-h-dvh bg-creme text-carvao">
        <header className="sticky top-0 z-20 border-b border-rico-wood/30 bg-creme pt-[env(safe-area-inset-top,0px)]">
          <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setEtapa('cardapio')}
              className="-ml-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-carvao hover:bg-carvao/6"
              aria-label="Voltar ao cardápio"
            >
              <ArrowLeft size={22} aria-hidden="true" />
            </button>
            <h1 className="font-display text-2xl text-carvao">Finalizar pedido</h1>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1120px] px-4 pb-44 pt-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:pb-12">
          <main className="min-w-0 lg:max-w-[640px]">
            {/* Resumo recolhível (celular). No desktop ele fica na coluna da direita. */}
            <section className="rounded-2xl border border-rico-wood/30 bg-white lg:hidden">
              <button
                type="button"
                onClick={() => setResumoAberto((v) => !v)}
                aria-expanded={resumoAberto}
                className="flex min-h-13 w-full items-center justify-between gap-3 px-4 text-left"
              >
                <span className="text-sm font-semibold text-carvao tabular-nums">
                  {plural(totalItens, 'item', 'itens')} · {moeda(subtotal)}
                </span>
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className={`shrink-0 text-carvao-suave transition-transform ${resumoAberto ? 'rotate-180' : ''}`}
                />
              </button>
              {resumoAberto && <div className="border-t border-creme-escuro px-4 pb-4 pt-3">{listaResumo}</div>}
            </section>

            {fechada && loja?.proximaAbertura && (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao">
                <Clock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Loja fechada agora. Seu pedido será <strong>agendado para {loja.proximaAbertura}</strong>.
                </span>
              </p>
            )}

            <fieldset className="mt-5">
              <legend className="mb-2 text-rotulo font-semibold text-carvao-suave">Como você quer receber?</legend>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'DELIVERY', rotulo: 'Entrega', Icone: Bike },
                  { id: 'BALCAO', rotulo: 'Retirada', Icone: ShoppingBag },
                ].map(({ id, rotulo, Icone }) => {
                  const indisponivel = id === 'DELIVERY' && deliveryPausado;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTipo(id)}
                      disabled={indisponivel}
                      aria-pressed={tipo === id}
                      className={`${opcao(tipo === id)} disabled:cursor-not-allowed disabled:border-creme-escuro disabled:bg-creme-escuro disabled:text-carvao-suave`}
                    >
                      <Icone size={22} aria-hidden="true" /> {rotulo}
                      {indisponivel && <span className="text-xs font-semibold">Pausado hoje</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {deliveryPausado && (
              <p className="mt-3 rounded-xl border border-atencao-borda bg-atencao-fundo p-3 text-sm text-atencao">
                Hoje estamos atendendo só <strong>retirada no local</strong>. Faça seu pedido e busque aqui.
              </p>
            )}

            {tipo === 'BALCAO' && loja?.endereco && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-rico-wood/30 bg-white p-4">
                <MapPin size={20} className="mt-0.5 shrink-0 text-rico-red" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-carvao">Retire na loja</p>
                  <p className="text-sm text-carvao-suave">{loja.endereco}</p>
                  <p className="mt-1 text-rotulo font-semibold text-ok">Retirada grátis</p>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <Campo
                id="campo-nome"
                rotulo="Seu nome"
                valor={form.nome}
                aoMudar={(v) => set('nome', v)}
                placeholder="Como te chamamos"
                autoComplete="name"
                erro={erros.nome}
              />
              <Campo
                id="campo-telefone"
                rotulo={tipo === 'DELIVERY' ? 'Telefone (WhatsApp)' : 'Telefone (opcional)'}
                valor={form.telefone}
                aoMudar={(v) => set('telefone', v)}
                placeholder="(88) 9 0000-0000"
                inputMode="tel"
                type="tel"
                autoComplete="tel"
                erro={erros.telefone}
              />
              {tipo === 'DELIVERY' && (
                <Campo
                  id="campo-endereco"
                  rotulo="Endereço de entrega"
                  valor={form.endereco}
                  aoMudar={(v) => set('endereco', v)}
                  placeholder="Rua, número, referência"
                  autoComplete="street-address"
                  erro={erros.endereco}
                  textarea
                />
              )}
              {tipo === 'DELIVERY' && bairros.length > 0 && (
                <CampoBase
                  id="campo-bairro"
                  como="select"
                  rotulo="Bairro"
                  value={form.bairro}
                  onChange={(e) => set('bairro', e.target.value)}
                  erro={erros.bairro}
                >
                  <option value="">Selecione o bairro</option>
                  {bairros.map((b) => (
                    <option key={b.nome} value={b.nome}>
                      {b.nome} — {moeda(b.taxa)}
                    </option>
                  ))}
                </CampoBase>
              )}
            </div>

            <fieldset className="mt-5">
              <legend className="mb-2 text-rotulo font-semibold text-carvao-suave">Forma de pagamento</legend>
              <div className="grid grid-cols-3 gap-2">
                {PAGAMENTOS.map(({ id, rotulo, Icone }, i) => (
                  <button
                    key={id}
                    id={i === 0 ? 'campo-pagamento' : undefined}
                    type="button"
                    onClick={() => set('pagamento', id)}
                    aria-pressed={form.pagamento === id}
                    aria-describedby={erros.pagamento ? 'erro-pagamento' : undefined}
                    className={opcao(form.pagamento === id)}
                  >
                    <Icone size={20} aria-hidden="true" /> {rotulo}
                  </button>
                ))}
              </div>
              {erros.pagamento && (
                <p id="erro-pagamento" className="mt-1 text-rotulo font-semibold text-rico-red">
                  {erros.pagamento}
                </p>
              )}
              {form.pagamento === 'dinheiro' && (
                <div className="mt-3">
                  <Campo
                    id="campo-troco"
                    rotulo="Troco para quanto? (opcional)"
                    valor={form.troco}
                    aoMudar={(v) => set('troco', v)}
                    placeholder="ex.: 50,00"
                    inputMode="decimal"
                    erro={erros.troco}
                  />
                </div>
              )}
            </fieldset>

            {/* Detalhamento (celular). No desktop fica no resumo fixo. */}
            <section className="mt-6 rounded-2xl border border-rico-wood/30 bg-white p-4 lg:hidden">
              <ResumoValores subtotal={subtotal} taxa={taxa} rotuloEntrega={rotuloEntrega} total={totalFinal} />
            </section>

            {erroCheckout && (
              <p role="alert" className="mt-4 rounded-xl bg-erro-fundo px-4 py-3 text-sm font-semibold text-rico-red lg:hidden">
                {erroCheckout}
              </p>
            )}
          </main>

          {/* Desktop: resumo fixo à direita */}
          <aside className="sticky top-24 hidden rounded-3xl border border-rico-wood/30 bg-white p-5 lg:block">
            <h2 className="font-display text-xl text-carvao">Seu pedido</h2>
            <p className="mb-4 text-rotulo text-carvao-suave">{plural(totalItens, 'item', 'itens')}</p>
            {listaResumo}
            <div className="mt-4 border-t border-creme-escuro pt-4">
              <ResumoValores subtotal={subtotal} taxa={taxa} rotuloEntrega={rotuloEntrega} total={totalFinal} />
            </div>
            {erroCheckout && (
              <p role="alert" className="mt-4 rounded-xl bg-erro-fundo px-3 py-2.5 text-sm font-semibold text-rico-red">
                {erroCheckout}
              </p>
            )}
            <div className="mt-4">{botaoConfirmar}</div>
          </aside>
        </div>

        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-rico-wood/30 bg-creme px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="mx-auto flex max-w-[640px] items-center gap-4">
            <div className="shrink-0">
              <p className="text-rotulo text-carvao-suave">Total</p>
              <p className="font-display text-2xl leading-tight text-carvao tabular-nums">{moeda(totalFinal)}</p>
            </div>
            <div className="flex-1">{botaoConfirmar}</div>
          </div>
        </footer>
      </div>
    );
  }

  /* ---------- Meus pedidos / Perfil ---------- */
  if (vista === 'pedidos' || vista === 'perfil') {
    return (
      <div className="min-h-dvh bg-creme text-carvao">
        <TopoLoja loja={loja} vista={vista} setVista={setVista} qtdPedidos={meusPedidos.length} />
        {vista === 'pedidos' ? (
          <MeusPedidos lista={meusPedidos} onIrAoCardapio={() => setVista('cardapio')} />
        ) : (
          <Perfil form={form} set={set} aoSalvar={salvarPerfil} />
        )}
        <BottomNav vista={vista} setVista={setVista} qtdPedidos={meusPedidos.length} />
      </div>
    );
  }

  /* ---------- cardápio ---------- */
  const conteudoSacola = carrinho.length ? (
    <>
      <ItensSacola linhas={carrinho} mudarQtd={mudarQtd} mudarObs={mudarObs} />
      <div className="mt-4 border-t border-creme-escuro pt-4">
        <ResumoValores
          subtotal={subtotal}
          taxa={0}
          rotuloEntrega={deliveryPausado ? null : 'No próximo passo'}
          total={subtotal}
        />
      </div>
    </>
  ) : (
    <p className="py-6 text-center text-sm text-carvao-suave">
      Sua sacola está vazia. Toque no <strong className="text-rico-red">+</strong> de um item para adicionar.
    </p>
  );
  const botaoAvancar = (
    <button
      type="button"
      onClick={abrirCheckout}
      disabled={ctaBloqueado || carrinho.length === 0}
      className="flex min-h-13 w-full items-center justify-center rounded-lg bg-rico-red px-4 text-base font-semibold text-white transition-colors hover:bg-vinho-profundo disabled:bg-creme-escuro disabled:text-carvao-suave"
    >
      {rotuloCta}
    </button>
  );

  return (
    <div className="min-h-dvh bg-creme text-carvao">
      <TopoLoja loja={loja} vista={vista} setVista={setVista} qtdPedidos={meusPedidos.length} />
      {fechada && (
        <p className="border-b border-atencao-borda bg-atencao-fundo px-4 py-2.5 text-center text-sm font-semibold text-atencao">
          {loja.proximaAbertura
            ? `Estamos fechados agora. Pedidos feitos agora são agendados para ${loja.proximaAbertura}.`
            : 'Estamos fechados agora. Volte no horário de funcionamento.'}
        </p>
      )}

      <div
        className={`mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,720px)_360px] lg:justify-between lg:gap-8 lg:pb-12 ${
          carrinho.length ? 'pb-[164px]' : 'pb-24'
        }`}
      >
        <div className="min-w-0">
          {/* Barra de categorias fixa ao rolar */}
          <div className="sticky top-0 z-20 -mx-4 border-b border-rico-wood/30 bg-creme px-4 py-2.5 sm:-mx-6 sm:px-6 lg:mx-0 lg:border-b-0 lg:px-0 lg:pt-6">
            {buscaAberta ? (
              <div className="flex items-center gap-2 lg:hidden">
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-inset ring-rico-wood/45 focus-within:ring-2 focus-within:ring-rico-red">
                  <Search size={18} className="shrink-0 text-carvao-suave" aria-hidden="true" />
                  <span className="sr-only">Buscar no cardápio</span>
                  <input
                    ref={campoBuscaRef}
                    type="search"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar no cardápio"
                    className="min-w-0 flex-1 bg-transparent text-sm text-carvao outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBusca('');
                    setBuscaAberta(false);
                  }}
                  aria-label="Fechar busca"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-carvao hover:bg-carvao/6"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <div className={`flex items-center gap-2 lg:gap-3 ${buscaAberta ? 'hidden lg:flex' : ''}`}>
              <button
                type="button"
                onClick={() => {
                  setBuscaAberta(true);
                  setTimeout(() => campoBuscaRef.current?.focus(), 0);
                }}
                aria-label="Buscar no cardápio"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-rico-wood/40 bg-white text-carvao lg:hidden"
              >
                <Search size={19} aria-hidden="true" />
              </button>
              <nav
                ref={chipsRef}
                aria-label="Categorias"
                className="sem-barra relative -mr-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pr-8 sm:-mr-6 lg:mr-0 lg:pr-0"
                style={{ maskImage: 'linear-gradient(90deg, #000 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 85%, transparent)' }}
              >
                {secoes.map((c) => (
                  <button
                    key={c.nome}
                    type="button"
                    data-chip={c.nome}
                    onClick={() => irParaCategoria(c.nome)}
                    aria-current={c.nome === categoriaAtiva ? 'true' : undefined}
                    className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors ${
                      c.nome === categoriaAtiva
                        ? 'border-carvao bg-carvao text-creme'
                        : 'border-rico-wood/40 bg-white text-carvao-suave hover:text-carvao'
                    }`}
                  >
                    {c.nome}
                  </button>
                ))}
              </nav>
              <label className="hidden min-h-11 w-[260px] shrink-0 items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-inset ring-rico-wood/45 focus-within:ring-2 focus-within:ring-rico-red lg:flex">
                <Search size={18} className="shrink-0 text-carvao-suave" aria-hidden="true" />
                <span className="sr-only">Buscar no cardápio</span>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar no cardápio"
                  className="min-w-0 flex-1 bg-transparent text-sm text-carvao outline-none"
                />
              </label>
            </div>
          </div>

          {secoes.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-rico-wood/30 bg-white px-4 py-10 text-center">
              <p className="text-sm font-semibold text-carvao">
                {busca.trim() ? `Nenhum item encontrado para “${busca.trim()}”.` : 'O cardápio está vazio no momento.'}
              </p>
              {busca.trim() && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="mt-3 min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-carvao ring-1 ring-inset ring-rico-wood/45 hover:bg-creme-escuro"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            secoes.map((c) => (
              <section
                key={c.nome}
                id={idSecao(c.nome)}
                data-categoria={c.nome}
                ref={(el) => {
                  if (el) secoesRef.current.set(c.nome, el);
                  else secoesRef.current.delete(c.nome);
                }}
                aria-labelledby={`${idSecao(c.nome)}-titulo`}
                className="scroll-mt-20 pt-6 lg:scroll-mt-24"
              >
                <h2 id={`${idSecao(c.nome)}-titulo`} className="mb-3 font-display text-2xl text-carvao">
                  {c.nome}
                </h2>
                <ul className="grid overflow-hidden rounded-2xl border border-rico-wood/30 bg-white lg:grid-cols-2 [&>li]:border-t [&>li]:border-creme-escuro [&>li:first-child]:border-t-0 lg:[&>li:nth-child(2)]:border-t-0 lg:[&>li:nth-child(even)]:border-l">
                  {c.itens.map((produto) => (
                    <LinhaProduto
                      key={produto.id}
                      produto={produto}
                      quantidade={qtdPorProduto[produto.id] || 0}
                      aoAdicionar={() => adicionar(produto)}
                      aoRemover={() => removerUm(produto.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {/* Desktop: sacola fixa à direita, já com o botão de avançar */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 mt-6 rounded-3xl border border-rico-wood/30 bg-white p-5">
            <h2 className="font-display text-xl text-carvao">Sua sacola</h2>
            <p className="mb-4 text-rotulo text-carvao-suave">{plural(totalItens, 'item', 'itens')}</p>
            <div className="max-h-[calc(100dvh-340px)] overflow-y-auto overscroll-contain pr-1">{conteudoSacola}</div>
            <div className="mt-4">{botaoAvancar}</div>
          </div>
        </aside>
      </div>

      {carrinho.length > 0 && (
        <BarraSacola totalItens={totalItens} subtotal={subtotal} aoAbrir={() => setSacolaAberta(true)} />
      )}
      <BottomNav vista={vista} setVista={setVista} qtdPedidos={meusPedidos.length} />

      <Sheet
        aberto={sacolaAberta}
        aoFechar={() => setSacolaAberta(false)}
        titulo="Sua sacola"
        subtitulo={`${plural(totalItens, 'item', 'itens')} · ${moeda(subtotal)}`}
        rodape={botaoAvancar}
      >
        {conteudoSacola}
      </Sheet>
    </div>
  );
}
