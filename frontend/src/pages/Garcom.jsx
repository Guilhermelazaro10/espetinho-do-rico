import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Flame, Delete, ArrowRight, Beef, Beer, UtensilsCrossed, ChevronLeft,
  Plus, Minus, Trash2, Send, Loader2, Monitor, LogOut, CloudOff, RefreshCw,
} from 'lucide-react';
import { api, moeda } from '../lib/api';
import { notificar, ToasterGlobal } from '../ui/toast';
import { adicionarNaFila, listarFila, sincronizarFila } from '../lib/filaOffline';

const ICONES_CATEGORIA = { Espetos: Beef, Bebidas: Beer };

/*
 * Módulo Garçom — mobile first, dark mode de salão, tolerante a queda de rede:
 * pedido sem conexão entra na fila local e é reenviado quando a rede volta.
 */
export default function Garcom({ aoSair }) {
  const [etapa, setEtapa] = useState('mesa'); // mesa | cardapio
  const [numero, setNumero] = useState('');
  const [mesa, setMesa] = useState(null);
  const [abrindo, setAbrindo] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [erroCardapio, setErroCardapio] = useState(false);
  const [categoria, setCategoria] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [tamanhoFila, setTamanhoFila] = useState(listarFila().length);

  const carregarCardapio = useCallback(() => {
    setErroCardapio(false);
    api.produtos
      .listar()
      .then(setProdutos)
      .catch((e) => {
        setErroCardapio(true);
        notificar.erro('Cardápio indisponível', e.message);
      });
  }, []);

  useEffect(() => {
    carregarCardapio();
  }, [carregarCardapio]);

  // Fila offline: tenta sincronizar quando a rede volta e a cada 30s
  const sincronizar = useCallback(async () => {
    if (listarFila().length === 0) return;
    const resultado = await sincronizarFila((p) => api.pedidos.criar(p));
    setTamanhoFila(resultado.restantes);
    if (resultado.enviados > 0) {
      notificar.sucesso(
        `${resultado.enviados} pedido(s) da fila enviado(s)`,
        'Conexão restabelecida'
      );
    }
    if (resultado.descartados > 0) {
      notificar.erro(
        `${resultado.descartados} pedido(s) da fila rejeitado(s)`,
        'Confira com o caixa antes de relançar'
      );
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
        notificar.erro(`Mesa ${numero} não existe`, 'Confira o número e tente de novo');
        return;
      }
      if (alvo.status === 'fechando') {
        notificar.erro(
          `Mesa ${alvo.numero} aguardando conta`,
          'Peça ao caixa para reabrir o consumo'
        );
        return;
      }
      setMesa(alvo);
      setEtapa('cardapio');
    } catch (e) {
      notificar.erro('Não foi possível abrir a mesa', e.message);
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

  function limparComanda() {
    setCarrinho([]);
    setMesa(null);
    setNumero('');
    setEtapa('mesa');
  }

  async function enviarPedido() {
    if (enviando || carrinho.length === 0) return; // trava anti-toque-duplo
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
      notificar.sucesso(
        `Pedido da mesa ${mesa.numero} enviado!`,
        `${totalItens} ${totalItens === 1 ? 'item' : 'itens'} · ${moeda(total)}`
      );
      limparComanda();
    } catch (e) {
      if (e.offline) {
        // Sem rede: o pedido NÃO se perde — entra na fila local
        adicionarNaFila(corpo);
        setTamanhoFila(listarFila().length);
        notificar.brasa(
          `Pedido da mesa ${mesa.numero} na fila offline`,
          'Será enviado sozinho quando a rede voltar'
        );
        limparComanda();
      } else {
        notificar.erro('Pedido não enviado', `${e.message} — os itens continuam na comanda.`);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-carvao text-rico-light">
      <ToasterGlobal />

      {/* Cabeçalho compacto de salão */}
      <header className="flex items-center justify-between border-b border-creme/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-brasa-clara" />
          <span className="font-display text-lg leading-none">Espetinho do Rico</span>
          <span className="rounded-full bg-rico-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            Garçom
          </span>
          {tamanhoFila > 0 && (
            <button
              onClick={sincronizar}
              className="flex items-center gap-1 rounded-full bg-brasa-gradiente px-2 py-0.5 text-[10px] font-bold text-white shadow-brasa"
              aria-label={`${tamanhoFila} pedidos na fila offline — tocar para reenviar`}
            >
              <CloudOff size={11} /> {tamanhoFila} na fila
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <a
            href="#/"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-rico-light/50 transition hover:bg-rico-light/10 hover:text-rico-light"
          >
            <Monitor size={14} /> Caixa
          </a>
          <button
            onClick={aoSair}
            className="rounded-lg p-1.5 text-rico-light/40 transition hover:bg-rico-light/10 hover:text-rico-light"
            aria-label="Sair"
          >
            <LogOut size={14} />
          </button>
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
          cardapio={{ categorias, categoria, setCategoria, produtos }}
          comanda={{ linhas: carrinho, total, totalItens, enviando }}
          acoes={{ voltar: () => setEtapa('mesa'), adicionarProduto, mudarQuantidade, mudarObservacao, enviarPedido }}
        />
      )}
    </div>
  );
}

/* ---------- Etapa 1: abrir a mesa ---------- */

function TelaMesa({ numero, setNumero, abrirMesa, abrindo, erroCardapio, recarregarCardapio }) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'limpar', '0', 'apagar'];

  function digitar(tecla) {
    if (tecla === 'limpar') return setNumero('');
    if (tecla === 'apagar') return setNumero((n) => n.slice(0, -1));
    setNumero((n) => (n + tecla).slice(0, 3));
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-8">
      {erroCardapio && (
        <button
          onClick={recarregarCardapio}
          className="mb-4 flex items-center justify-center gap-2 rounded-xl border-2 border-brasa/40 px-3 py-2 text-sm font-bold text-brasa-clara"
        >
          <RefreshCw size={14} /> Cardápio falhou — tocar para recarregar
        </button>
      )}

      <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-rico-light/50">
        Abrir mesa
      </p>

      {/* Display gigante do número */}
      <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-rico-light/5 ring-1 ring-rico-light/10">
        <span className={`font-display text-6xl ${numero ? 'text-rico-light' : 'text-rico-light/20'}`}>
          {numero || '00'}
        </span>
      </div>

      {/* Teclado numérico gigante */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {teclas.map((tecla) => (
          <button
            key={tecla}
            onClick={() => digitar(tecla)}
            className="flex h-16 items-center justify-center rounded-xl bg-rico-light/8 text-2xl
              font-bold text-rico-light ring-1 ring-rico-light/10 transition
              active:scale-95 active:bg-rico-light/15"
            aria-label={tecla === 'apagar' ? 'Apagar' : tecla === 'limpar' ? 'Limpar' : tecla}
          >
            {tecla === 'apagar' ? (
              <Delete size={24} />
            ) : tecla === 'limpar' ? (
              <span className="text-sm font-bold uppercase text-rico-light/60">Limpar</span>
            ) : (
              tecla
            )}
          </button>
        ))}
      </div>

      <button
        onClick={abrirMesa}
        disabled={!numero || abrindo}
        className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-rico-red
          text-lg font-bold text-rico-light shadow-media transition active:scale-[0.98]
          disabled:cursor-not-allowed disabled:opacity-35"
      >
        {abrindo ? (
          <>
            <Loader2 size={22} className="animate-spin" /> Abrindo…
          </>
        ) : (
          <>
            Abrir mesa {numero && `${Number(numero)}`} <ArrowRight size={22} />
          </>
        )}
      </button>
    </main>
  );
}

/* ---------- Etapa 2: cardápio + comanda ---------- */

function TelaCardapio({ mesa, cardapio, comanda, acoes }) {
  const { categorias, categoria, setCategoria, produtos } = cardapio;
  const { linhas, total, totalItens, enviando } = comanda;
  const visiveis = produtos.filter((p) => p.categoria === categoria);

  return (
    <>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-36">
        {/* Mesa ativa */}
        <div className="mt-4 flex items-center justify-between rounded-xl bg-rico-red px-4 py-3 shadow-media">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-rico-light/60">
              Atendendo
            </p>
            <p className="font-display text-2xl leading-tight">
              Mesa {String(mesa.numero).padStart(2, '0')}
            </p>
          </div>
          <button
            onClick={acoes.voltar}
            className="flex items-center gap-1 rounded-xl bg-rico-light/10 px-3 py-2 text-sm font-bold transition active:scale-95"
          >
            <ChevronLeft size={16} /> Trocar
          </button>
        </div>

        {/* Grid de categorias */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {categorias.map((nome) => {
            const Icone = ICONES_CATEGORIA[nome] ?? UtensilsCrossed;
            const ativa = nome === categoria;
            return (
              <button
                key={nome}
                onClick={() => setCategoria(nome)}
                className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl
                  text-sm font-bold transition active:scale-95 ${
                    ativa
                      ? 'bg-brasa-gradiente text-white shadow-brasa'
                      : 'bg-rico-light/8 text-rico-light/70 ring-1 ring-rico-light/10'
                  }`}
              >
                <Icone size={24} strokeWidth={2} />
                {nome}
              </button>
            );
          })}
        </div>

        {/* Itens da categoria */}
        <ul className="mt-4 space-y-2">
          {visiveis.map((produto) => (
            <li key={produto.id}>
              <button
                onClick={() => acoes.adicionarProduto(produto)}
                className="flex w-full items-center justify-between rounded-xl bg-rico-light/5 px-4
                  py-3.5 ring-1 ring-rico-light/10 transition active:scale-[0.98] active:bg-rico-light/10"
              >
                <div className="text-left">
                  <p className="font-bold text-rico-light">{produto.nome}</p>
                  <p className="text-sm text-rico-light/50">{moeda(produto.preco)}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rico-red">
                  <Plus size={20} strokeWidth={2.5} />
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Comanda */}
        {linhas.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-rico-light/50">
              Comanda · {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            </h2>
            <ul className="space-y-3">
              {linhas.map((linha, i) => (
                <li key={`${linha.produto.id}-${i}`} className="rounded-xl bg-rico-light/5 p-3 ring-1 ring-rico-light/10">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate font-bold">{linha.produto.nome}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => acoes.mudarQuantidade(i, -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-rico-light/10 transition active:scale-90"
                        aria-label="Diminuir"
                      >
                        {linha.quantidade === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                      </button>
                      <span className="w-6 text-center text-lg font-bold">{linha.quantidade}</span>
                      <button
                        onClick={() => acoes.mudarQuantidade(i, 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-rico-red transition active:scale-90"
                        aria-label="Aumentar"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={linha.observacao}
                      onChange={(e) => acoes.mudarObservacao(i, e.target.value)}
                      placeholder="Obs: sem cebola, bem passado…"
                      maxLength={120}
                      className="min-w-0 flex-1 rounded-lg bg-carvao px-3 py-2 text-sm text-rico-light
                        outline-none ring-1 ring-rico-light/15 placeholder:text-rico-light/30
                        focus:ring-brasa"
                    />
                    <span className="shrink-0 text-sm font-bold text-rico-light/70">
                      {moeda(linha.produto.preco * linha.quantidade)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* Rodapé fixo: enviar pedido */}
      <footer
        className="fixed inset-x-0 bottom-0 border-t border-creme/10 bg-carvao/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
      >
        <div className="mx-auto max-w-md">
          <button
            onClick={acoes.enviarPedido}
            disabled={linhas.length === 0 || enviando}
            className="flex h-16 w-full items-center justify-center gap-2.5 rounded-xl bg-rico-red
              text-lg font-bold text-rico-light shadow-media transition active:scale-[0.98]
              disabled:cursor-not-allowed disabled:opacity-35"
          >
            {enviando ? (
              <>
                <Loader2 size={22} className="animate-spin" /> Enviando pedido…
              </>
            ) : (
              <>
                <Send size={20} />
                Enviar pedido
                {totalItens > 0 && <span className="text-rico-light/70">· {moeda(total)}</span>}
              </>
            )}
          </button>
        </div>
      </footer>
    </>
  );
}
