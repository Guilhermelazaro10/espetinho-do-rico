import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame, Delete, ArrowRight, Beef, Beer, UtensilsCrossed, ChevronLeft,
  Plus, Minus, Trash2, Send, Loader2, Monitor, LogOut, CloudOff, RefreshCw,
  ShoppingCart, X, Search, ArrowLeft, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { api, moeda } from '../lib/api';
import { notificar, ToasterGlobal } from '../ui/toast';
import { adicionarNaFila, listarFila, sincronizarFila } from '../lib/filaOffline';

const ICONES_CATEGORIA = { Espetinhos: Beef, Bebidas: Beer, Guarnições: UtensilsCrossed };

export default function Garcom({ aoSair }) {
  const [etapa, setEtapa] = useState('mesa');
  const [numero, setNumero] = useState('');
  const [mesa, setMesa] = useState(null);
  const [abrindo, setAbrindo] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [erroCardapio, setErroCardapio] = useState(false);
  const [categoria, setCategoria] = useState(null);
  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [comandaAberta, setComandaAberta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [tamanhoFila, setTamanhoFila] = useState(listarFila().length);

  const carregarCardapio = useCallback(() => {
    setErroCardapio(false);
    api.produtos
      .listar()
      .then(setProdutos)
      .catch((e) => {
        setErroCardapio(true);
        notificar.erro('Cardapio indisponivel', e.message);
      });
  }, []);

  useEffect(() => {
    carregarCardapio();
  }, [carregarCardapio]);

  const sincronizar = useCallback(async () => {
    if (listarFila().length === 0) return;
    const resultado = await sincronizarFila((p) => api.pedidos.criar(p));
    setTamanhoFila(resultado.restantes);
    if (resultado.enviados > 0) {
      notificar.sucesso(`${resultado.enviados} pedido(s) enviado(s)`, 'Fila sincronizada');
    }
    if (resultado.descartados > 0) {
      notificar.erro(`${resultado.descartados} pedido(s) rejeitado(s)`, 'Confira com o caixa');
    }
  }, []);

  useEffect(() => {
    window.addEventListener('online', sincronizar);
    const timer = setInterval(sincronizar, 30000);
    return () => {
      window.removeEventListener('online', sincronizar);
      clearInterval(timer);
    };
  }, [sincronizar]);

  const categorias = useMemo(
    () => [...new Set(produtos.map((p) => p.categoria))],
    [produtos]
  );

  useEffect(() => {
    if (!categoria && categorias.length) setCategoria(categorias[0]);
  }, [categorias, categoria]);

  const total = carrinho.reduce((s, l) => s + l.produto.preco * l.quantidade, 0);
  const totalItens = carrinho.reduce((s, l) => s + l.quantidade, 0);

  async function abrirMesa() {
    if (abrindo || !numero) return;
    setAbrindo(true);
    try {
      const mesas = await api.mesas.listar();
      const alvo = mesas.find((m) => m.numero === Number(numero));
      if (!alvo) {
        notificar.erro(`Mesa ${numero} nao existe`, 'Confira o numero e tente novamente');
        return;
      }
      if (alvo.status === 'fechando') {
        notificar.erro(`Mesa ${alvo.numero} aguardando conta`, 'Peca ao caixa para reabrir');
        return;
      }
      setMesa(alvo);
      setEtapa('cardapio');
      setComandaAberta(false);
    } catch (e) {
      notificar.erro('Nao foi possivel abrir a mesa', e.message);
    } finally {
      setAbrindo(false);
    }
  }

  function adicionarProduto(produto) {
    setCarrinho((linhas) => {
      const i = linhas.findIndex((l) => l.produto.id === produto.id && !l.observacao);
      if (i >= 0) {
        const novas = [...linhas];
        novas[i] = { ...novas[i], quantidade: novas[i].quantidade + 1 };
        return novas;
      }
      return [...linhas, { produto, quantidade: 1, observacao: '' }];
    });
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function mudarQuantidade(indice, delta) {
    setCarrinho((linhas) =>
      linhas
        .map((l, i) => (i === indice ? { ...l, quantidade: l.quantidade + delta } : l))
        .filter((l) => l.quantidade > 0)
    );
  }

  function mudarObservacao(indice, observacao) {
    setCarrinho((linhas) => linhas.map((l, i) => (i === indice ? { ...l, observacao } : l)));
  }

  function trocarMesa() {
    setMesa(null);
    setNumero('');
    setBusca('');
    setComandaAberta(false);
    setEtapa('mesa');
  }

  function limparComanda() {
    setCarrinho([]);
    trocarMesa();
  }

  async function enviarPedido() {
    if (enviando || carrinho.length === 0) return;
    setEnviando(true);
    const corpo = {
      mesaId: mesa.id,
      itens: carrinho.map((l) => ({
        produtoId: l.produto.id,
        quantidade: l.quantidade,
        observacao: l.observacao.trim() || undefined,
      })),
    };
    try {
      await api.pedidos.criar(corpo);
      notificar.sucesso(`Pedido da mesa ${mesa.numero} enviado`, `${totalItens} item(ns) - ${moeda(total)}`);
      limparComanda();
    } catch (e) {
      if (e.offline) {
        adicionarNaFila(corpo);
        setTamanhoFila(listarFila().length);
        notificar.brasa(`Pedido da mesa ${mesa.numero} na fila`, 'Sera enviado quando a rede voltar');
        limparComanda();
      } else {
        notificar.erro('Pedido nao enviado', `${e.message} - os itens continuam na comanda`);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-carvao text-rico-light">
      <ToasterGlobal />

      <header className="sticky top-0 z-30 border-b border-creme/10 bg-carvao/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {etapa === 'cardapio' ? (
              <button
                onClick={trocarMesa}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rico-light/10 text-rico-light ring-1 ring-rico-light/10 active:scale-95"
                aria-label="Voltar para escolher mesa"
              >
                <ArrowLeft size={22} />
              </button>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rico-red text-rico-light shadow-brasa">
                <Flame size={22} />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-tight">Espetinho do Rico</p>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rico-wood">
                {etapa === 'cardapio' && mesa ? `Mesa ${String(mesa.numero).padStart(2, '0')}` : 'Modo garcom'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {tamanhoFila > 0 && (
              <button
                onClick={sincronizar}
                className="flex h-11 items-center gap-1.5 rounded-2xl bg-brasa-gradiente px-3 text-xs font-extrabold text-white shadow-brasa active:scale-95"
                aria-label={`${tamanhoFila} pedidos na fila offline`}
              >
                <CloudOff size={17} /> {tamanhoFila}
              </button>
            )}
            <a
              href="#/"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rico-light/8 text-rico-light/70 ring-1 ring-rico-light/10 active:scale-95"
              aria-label="Ir para o caixa"
            >
              <Monitor size={20} />
            </a>
            <button
              onClick={aoSair}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rico-light/8 text-rico-light/70 ring-1 ring-rico-light/10 active:scale-95"
              aria-label="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {etapa === 'mesa' ? (
        <TelaMesa
          numero={numero}
          setNumero={setNumero}
          abrirMesa={abrirMesa}
          abrindo={abrindo}
          erroCardapio={erroCardapio}
          recarregarCardapio={carregarCardapio}
        />
      ) : (
        <TelaCardapio
          mesa={mesa}
          cardapio={{ categorias, categoria, setCategoria, produtos, busca, setBusca }}
          comanda={{ linhas: carrinho, total, totalItens, enviando, comandaAberta, setComandaAberta }}
          acoes={{ voltar: trocarMesa, adicionarProduto, mudarQuantidade, mudarObservacao, enviarPedido }}
        />
      )}
    </div>
  );
}

function TelaMesa({ numero, setNumero, abrirMesa, abrindo, erroCardapio, recarregarCardapio }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'limpar', '0', 'apagar'];

  function digitar(tecla) {
    if (tecla === 'limpar') return setNumero('');
    if (tecla === 'apagar') return setNumero((n) => n.slice(0, -1));
    setNumero((n) => (n + tecla).slice(0, 3));
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
      {erroCardapio && (
        <button
          onClick={recarregarCardapio}
          className="mb-4 flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-brasa/40 px-4 py-3 text-sm font-extrabold text-brasa-clara active:scale-[0.98]"
        >
          <RefreshCw size={18} /> Recarregar cardapio
        </button>
      )}

      <div className="rounded-[1.35rem] border border-rico-light/10 bg-rico-light/[0.06] p-4 shadow-flutuante">
        <p className="text-center text-xs font-extrabold uppercase tracking-[0.28em] text-rico-light/50">
          Digite a mesa
        </p>

        <div className="mt-3 flex h-28 items-center justify-center rounded-2xl bg-rico-light/7 ring-1 ring-rico-light/10">
          <span className={`font-display text-7xl leading-none ${numero ? 'text-rico-light' : 'text-rico-light/20'}`}>
            {numero || '00'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {teclas.map((tecla) => (
            <button
              key={tecla}
              onClick={() => digitar(tecla)}
              className="flex min-h-[68px] items-center justify-center rounded-2xl bg-rico-light/10 text-3xl font-extrabold text-rico-light ring-1 ring-rico-light/10 transition active:scale-95 active:bg-rico-red"
              aria-label={tecla === 'apagar' ? 'Apagar' : tecla === 'limpar' ? 'Limpar' : tecla}
            >
              {tecla === 'apagar' ? (
                <Delete size={26} />
              ) : tecla === 'limpar' ? (
                <span className="text-sm font-extrabold uppercase text-rico-light/65">Limpar</span>
              ) : (
                tecla
              )}
            </button>
          ))}
        </div>

        <button
          onClick={abrirMesa}
          disabled={!numero || abrindo}
          className="mt-5 flex min-h-[68px] w-full items-center justify-center gap-2 rounded-2xl bg-rico-red text-lg font-extrabold text-rico-light shadow-brasa transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {abrindo ? (
            <>
              <Loader2 size={24} className="animate-spin" /> Abrindo
            </>
          ) : (
            <>
              Abrir mesa {numero && `${Number(numero)}`} <ArrowRight size={24} />
            </>
          )}
        </button>
      </div>
    </main>
  );
}

function TelaCardapio({ mesa, cardapio, comanda, acoes }) {
  const { categorias, categoria, setCategoria, produtos, busca, setBusca } = cardapio;
  const { linhas, total, totalItens, enviando, comandaAberta, setComandaAberta } = comanda;
  const listaRef = useRef(null);

  const visiveis = produtos.filter((p) => {
    const mesmaCategoria = p.categoria === categoria;
    const termo = busca.trim().toLowerCase();
    return mesmaCategoria && (!termo || p.nome.toLowerCase().includes(termo));
  });

  const qtdPorProduto = useMemo(() => {
    const m = {};
    for (const l of linhas) m[l.produto.id] = (m[l.produto.id] || 0) + l.quantidade;
    return m;
  }, [linhas]);

  function aoMudarCategoria(nome) {
    setCategoria(nome);
    listaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
      <main ref={listaRef} className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-44 pt-4">
        <section className="rounded-[1.35rem] bg-rico-red p-4 shadow-brasa">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-rico-light/65">
                Atendendo agora
              </p>
              <h1 className="font-display text-4xl leading-none">
                Mesa {String(mesa.numero).padStart(2, '0')}
              </h1>
            </div>
            <button
              onClick={acoes.voltar}
              className="flex min-h-12 items-center gap-1.5 rounded-2xl bg-rico-light/12 px-4 text-sm font-extrabold ring-1 ring-rico-light/15 active:scale-95"
            >
              <ChevronLeft size={18} /> Voltar
            </button>
          </div>
        </section>

        <label className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-rico-light/8 px-4 ring-1 ring-rico-light/10">
          <Search size={20} className="text-rico-light/45" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item"
            className="min-w-0 flex-1 bg-transparent text-base font-bold text-rico-light outline-none placeholder:text-rico-light/35"
          />
          {busca && (
            <button onClick={() => setBusca('')} className="rounded-xl p-2 text-rico-light/60 active:bg-rico-light/10" aria-label="Limpar busca">
              <X size={18} />
            </button>
          )}
        </label>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {categorias.map((nome) => {
            const Icone = ICONES_CATEGORIA[nome] ?? UtensilsCrossed;
            const ativa = nome === categoria;
            return (
              <button
                key={nome}
                onClick={() => aoMudarCategoria(nome)}
                className={`flex min-h-16 min-w-[128px] items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold transition active:scale-95 ${
                  ativa
                    ? 'bg-brasa-gradiente text-white shadow-brasa'
                    : 'bg-rico-light/8 text-rico-light/72 ring-1 ring-rico-light/10'
                }`}
              >
                <Icone size={22} strokeWidth={2.25} />
                {nome}
              </button>
            );
          })}
        </div>

        <ul className="mt-4 space-y-3">
          {visiveis.map((produto) => {
            const qtd = qtdPorProduto[produto.id] || 0;
            return (
            <li key={produto.id}>
              <button
                onClick={() => acoes.adicionarProduto(produto)}
                className={`flex min-h-[78px] w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left ring-1 transition active:scale-[0.98] ${qtd > 0 ? 'bg-rico-light/12 ring-rico-red/40' : 'bg-rico-light/6 ring-rico-light/10 active:bg-rico-light/12'}`}
              >
                <span className="min-w-0">
                  <span className="block text-base font-extrabold text-rico-light">{produto.nome}</span>
                  <span className="mt-1 block text-sm font-bold text-rico-wood">{moeda(produto.preco)}</span>
                </span>
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rico-red shadow-brasa">
                  <Plus size={24} strokeWidth={2.7} />
                  {qtd > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rico-wood px-1 text-xs font-extrabold text-rico-dark ring-2 ring-carvao">
                      {qtd}
                    </span>
                  )}
                </span>
              </button>
            </li>
            );
          })}
          {visiveis.length === 0 && (
            <li className="rounded-2xl bg-rico-light/6 px-4 py-8 text-center text-sm font-bold text-rico-light/55 ring-1 ring-rico-light/10">
              Nenhum item encontrado.
            </li>
          )}
        </ul>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-creme/10 bg-carvao/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={() => linhas.length > 0 && setComandaAberta(true)}
            disabled={linhas.length === 0}
            className="mb-2 flex w-full items-center justify-between gap-2 rounded-2xl bg-rico-light/8 px-3.5 py-2.5 text-left ring-1 ring-rico-light/10 transition active:scale-[0.99] disabled:opacity-55"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-rico-light/70">
              <ShoppingCart size={18} className="text-rico-wood" />
              {totalItens > 0
                ? `${totalItens} ${totalItens === 1 ? 'item' : 'itens'} — toque p/ revisar`
                : 'Comanda vazia'}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-base font-extrabold text-rico-wood">
              {moeda(total)}
              {linhas.length > 0 && <ChevronRight size={17} className="text-rico-light/40" />}
            </span>
          </button>
          <button
            onClick={acoes.enviarPedido}
            disabled={linhas.length === 0 || enviando}
            className="flex min-h-[64px] w-full items-center justify-center gap-2.5 rounded-2xl bg-rico-red text-lg font-extrabold text-rico-light shadow-brasa transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {enviando ? (
              <>
                <Loader2 size={23} className="animate-spin" /> Enviando
              </>
            ) : (
              <>
                <Send size={22} />
                Enviar pedido
              </>
            )}
          </button>
        </div>
      </footer>

      <ComandaSheet
        aberta={comandaAberta}
        fechar={() => setComandaAberta(false)}
        linhas={linhas}
        total={total}
        totalItens={totalItens}
        acoes={acoes}
      />
    </>
  );
}

function ComandaSheet({ aberta, fechar, linhas, total, totalItens, acoes }) {
  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/45" role="dialog" aria-modal="true">
      <button className="absolute inset-0 h-full w-full cursor-default" onClick={fechar} aria-label="Fechar comanda" />
      <section className="relative max-h-[82dvh] w-full rounded-t-[1.6rem] bg-rico-light text-carvao shadow-flutuante">
        <header className="sticky top-0 z-10 rounded-t-[1.6rem] border-b border-rico-wood/25 bg-rico-light px-4 py-4">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-carvao-suave">
                Comanda
              </p>
              <h2 className="font-display text-2xl text-rico-dark">
                {totalItens} {totalItens === 1 ? 'item' : 'itens'} - {moeda(total)}
              </h2>
            </div>
            <button
              onClick={fechar}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-carvao/8 text-carvao active:scale-95"
              aria-label="Fechar"
            >
              <X size={24} />
            </button>
          </div>
        </header>

        <div className="mx-auto max-h-[64dvh] max-w-md overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ul className="space-y-3">
            {linhas.map((linha, i) => (
              <li key={`${linha.produto.id}-${i}`} className="rounded-2xl border border-rico-wood/25 bg-white p-3 shadow-suave">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-base font-extrabold text-carvao">{linha.produto.nome}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => acoes.mudarQuantidade(i, -1)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-carvao/8 text-carvao active:scale-95"
                      aria-label="Diminuir"
                    >
                      {linha.quantidade === 1 ? <Trash2 size={20} /> : <Minus size={20} />}
                    </button>
                    <span className="w-8 text-center text-xl font-extrabold">{linha.quantidade}</span>
                    <button
                      onClick={() => acoes.mudarQuantidade(i, 1)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rico-red text-rico-light shadow-brasa active:scale-95"
                      aria-label="Aumentar"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <label className="mt-3 block">
                  <span className="sr-only">Observacao</span>
                  <input
                    type="text"
                    value={linha.observacao}
                    onChange={(e) => acoes.mudarObservacao(i, e.target.value)}
                    placeholder="Observacao: sem cebola, bem passado..."
                    maxLength={120}
                    className="min-h-12 w-full rounded-2xl bg-creme px-4 text-base font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 placeholder:text-carvao/35 focus:ring-rico-red"
                  />
                </label>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-carvao-suave">Subtotal</span>
                  <span className="text-base font-extrabold text-rico-red">
                    {moeda(linha.produto.preco * linha.quantidade)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={fechar}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-carvao font-extrabold text-rico-light active:scale-[0.98]"
          >
            <CheckCircle2 size={21} /> Continuar lancando
          </button>
        </div>
      </section>
    </div>
  );
}
