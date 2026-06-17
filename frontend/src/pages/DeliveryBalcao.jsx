import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bike, Store, Plus, Minus, Trash2, Send, RefreshCw, CheckCircle2, CreditCard,
  Banknote, QrCode, Ban, Clock, ReceiptText, Loader2, Printer,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, moeda, paraCentavos } from '../lib/api';
import { ehGerente, TIPOS_PEDIDO } from '../lib/constantes';
import { notificar } from '../ui/toast';
import { pedirTexto } from '../lib/dialogos';
import { useAtualizacaoAoVivo } from '../hooks/useAtualizacaoAoVivo';

const STATUS_ROTULO = {
  aberto: 'Aberto',
  em_preparo: 'Em preparo',
  entregue: 'Entregue',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const FORM_VAZIO = { clienteNome: '', clienteTelefone: '', clienteEndereco: '', taxaEntrega: '5,00' };

export default function DeliveryBalcao({ sessao, aoSair }) {
  const [aba, setAba] = useState(TIPOS_PEDIDO.DELIVERY);
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const gerente = ehGerente(sessao);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [catalogo, delivery, balcao] = await Promise.all([
        api.produtos.listar(),
        api.pedidos.listarAbertos(TIPOS_PEDIDO.DELIVERY),
        api.pedidos.listarAbertos(TIPOS_PEDIDO.BALCAO),
      ]);
      setProdutos(catalogo);
      setPedidos([...delivery, ...balcao]);
    } catch (e) {
      notificar.erro('Delivery indisponivel', e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);
  useAtualizacaoAoVivo(recarregar); // tempo real, igual ao Salão/Cozinha

  const produtosPorCategoria = useMemo(() => {
    const grupos = new Map();
    for (const produto of produtos) {
      const lista = grupos.get(produto.categoria) ?? [];
      lista.push(produto);
      grupos.set(produto.categoria, lista);
    }
    return [...grupos.entries()];
  }, [produtos]);

  const taxa = aba === TIPOS_PEDIDO.DELIVERY ? paraCentavos(form.taxaEntrega) : 0;
  const totalItens = carrinho.reduce((soma, item) => soma + item.produto.preco * item.quantidade, 0);
  const total = totalItens + taxa;

  function alterarForm(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function adicionar(produto) {
    setCarrinho((itens) => {
      const indice = itens.findIndex((item) => item.produto.id === produto.id && !item.observacao);
      if (indice < 0) return [...itens, { produto, quantidade: 1, observacao: '' }];
      return itens.map((item, i) =>
        i === indice ? { ...item, quantidade: item.quantidade + 1 } : item
      );
    });
  }

  function mudarQuantidade(indice, delta) {
    setCarrinho((itens) =>
      itens
        .map((item, i) => (i === indice ? { ...item, quantidade: item.quantidade + delta } : item))
        .filter((item) => item.quantidade > 0)
    );
  }

  function mudarObservacao(indice, observacao) {
    setCarrinho((itens) => itens.map((item, i) => (i === indice ? { ...item, observacao } : item)));
  }

  async function criarPedido() {
    if (enviando) return; // trava anti-duplo-toque
    if (carrinho.length === 0) {
      notificar.erro('Comanda vazia', 'Adicione ao menos um item');
      return;
    }
    setEnviando(true);
    const corpo = {
      tipo: aba,
      clienteNome: form.clienteNome,
      itens: carrinho.map((item) => ({
        produtoId: item.produto.id,
        quantidade: item.quantidade,
        observacao: item.observacao?.trim() || undefined,
      })),
      ...(aba === TIPOS_PEDIDO.DELIVERY
        ? {
            clienteTelefone: form.clienteTelefone,
            clienteEndereco: form.clienteEndereco,
            taxaEntrega: taxa,
          }
        : {}),
    };
    try {
      await api.pedidos.criar(corpo);
      notificar.sucesso('Pedido enviado', `${aba === TIPOS_PEDIDO.DELIVERY ? 'Delivery' : 'Balcao'} ${moeda(total)}`);
      setCarrinho([]);
      setForm(FORM_VAZIO);
      await recarregar();
    } catch (e) {
      notificar.erro('Pedido nao enviado', e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function avancar(pedido) {
    const proximo = pedido.status === 'aberto' ? 'em_preparo' : 'entregue';
    try {
      await api.pedidos.atualizarStatus(pedido.id, proximo);
      await recarregar();
    } catch (e) {
      notificar.erro('Status nao atualizado', e.message);
    }
  }

  async function pagar(pedido, formaPagamento) {
    try {
      await api.pedidos.pagar(pedido.id, formaPagamento);
      notificar.sucesso('Pedido pago', `${pedido.clienteNome ?? 'Cliente'} via ${formaPagamento}`);
      await recarregar();
    } catch (e) {
      notificar.erro('Pagamento recusado', e.message);
    }
  }

  async function reimprimir(pedido) {
    try {
      await api.pedidos.imprimir(pedido.id);
      notificar.brasa('Comanda reimpressa', `#${pedido.id}`);
    } catch (e) {
      notificar.erro('Nao foi possivel reimprimir', e.message);
    }
  }

  async function cancelar(pedido) {
    const motivo = await pedirTexto({
      titulo: `Cancelar pedido #${pedido.id}?`,
      mensagem: 'Descreva o motivo (fica registrado na auditoria).',
      placeholder: 'ex: cliente desistiu',
      confirmarRotulo: 'Cancelar pedido',
      obrigatorio: true,
      perigo: true,
    });
    if (!motivo) return;
    try {
      await api.pedidos.cancelar(pedido.id, motivo);
      notificar.sucesso(`Pedido #${pedido.id} cancelado`, 'Registrado na auditoria');
      await recarregar();
    } catch (e) {
      notificar.erro('Cancelamento recusado', e.message);
    }
  }

  const pedidosDaAba = pedidos.filter((pedido) => pedido.tipo === aba);

  const acoes = (
    <button
      onClick={recarregar}
      className="flex items-center gap-2 rounded-lg bg-carvao px-3 py-2 text-xs font-bold text-rico-light transition hover:bg-carvao-claro"
    >
      <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Atualizar
    </button>
  );

  return (
    <AppShell titulo="Delivery e Balcao" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <div className="inline-flex rounded-xl bg-white p-1 shadow-suave ring-1 ring-rico-wood/30">
            <Aba ativa={aba === TIPOS_PEDIDO.DELIVERY} onClick={() => setAba(TIPOS_PEDIDO.DELIVERY)} Icone={Bike}>
              Delivery
            </Aba>
            <Aba ativa={aba === TIPOS_PEDIDO.BALCAO} onClick={() => setAba(TIPOS_PEDIDO.BALCAO)} Icone={Store}>
              Balcao
            </Aba>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-4">
              {produtosPorCategoria.map(([categoria, lista]) => (
                <div key={categoria}>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-carvao-suave">
                    {categoria}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {lista.map((produto) => (
                      <button
                        key={produto.id}
                        onClick={() => adicionar(produto)}
                        className="flex min-h-24 items-center justify-between rounded-xl border border-rico-wood/25 bg-white/82 px-4 py-3 text-left shadow-suave transition hover:-translate-y-0.5 hover:border-rico-red/35 hover:shadow-media"
                      >
                        <span>
                          <span className="block font-bold text-carvao">{produto.nome}</span>
                          <span className="text-sm font-semibold text-rico-red">{moeda(produto.preco)}</span>
                        </span>
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rico-red text-rico-light">
                          <Plus size={18} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <aside className="rounded-xl bg-rico-dark p-4 text-rico-light shadow-media">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rico-light/70">
                <ReceiptText size={16} /> Novo pedido
              </h2>
              <div className="mt-4 space-y-3">
                <Input rotulo="Cliente" valor={form.clienteNome} onChange={(v) => alterarForm('clienteNome', v)} />
                {aba === TIPOS_PEDIDO.DELIVERY && (
                  <>
                    <Input rotulo="Telefone" valor={form.clienteTelefone} onChange={(v) => alterarForm('clienteTelefone', v)} />
                    <Input rotulo="Endereco" valor={form.clienteEndereco} onChange={(v) => alterarForm('clienteEndereco', v)} />
                    <Input rotulo="Taxa" valor={form.taxaEntrega} onChange={(v) => alterarForm('taxaEntrega', v)} />
                  </>
                )}
              </div>

              <ul className="mt-4 space-y-2">
                {carrinho.map((item, indice) => (
                  <li key={`${item.produto.id}-${indice}`} className="rounded-lg bg-rico-light/8 p-3 ring-1 ring-rico-light/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-bold">{item.produto.nome}</p>
                      <p className="text-sm font-bold text-rico-wood">
                        {moeda(item.produto.preco * item.quantidade)}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => mudarQuantidade(indice, -1)} className="rounded-md bg-rico-light/10 p-2" aria-label="Diminuir">
                        {item.quantidade === 1 ? <Trash2 size={15} /> : <Minus size={15} />}
                      </button>
                      <span className="w-8 text-center font-bold">{item.quantidade}</span>
                      <button onClick={() => mudarQuantidade(indice, 1)} className="rounded-md bg-rico-red p-2" aria-label="Aumentar">
                        <Plus size={15} />
                      </button>
                    </div>
                    <input
                      value={item.observacao}
                      onChange={(e) => mudarObservacao(indice, e.target.value)}
                      placeholder="Obs: sem cebola..."
                      maxLength={120}
                      className="mt-2 w-full rounded-md bg-rico-dark px-3 py-2 text-xs text-rico-light outline-none ring-1 ring-rico-light/15 placeholder:text-rico-light/30 focus:ring-rico-wood"
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-creme/10 pt-4">
                <div className="flex justify-between text-sm text-rico-light/60">
                  <span>Itens</span>
                  <strong className="text-rico-light">{moeda(totalItens)}</strong>
                </div>
                {taxa > 0 && (
                  <div className="flex justify-between text-sm text-rico-light/60">
                    <span>Entrega</span>
                    <strong className="text-rico-light">{moeda(taxa)}</strong>
                  </div>
                )}
                <div className="mt-2 flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-rico-wood">{moeda(total)}</span>
                </div>
              </div>
              <button
                onClick={criarPedido}
                disabled={enviando}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rico-red font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {enviando ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Send size={17} /> Enviar
                  </>
                )}
              </button>
            </aside>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-carvao-suave">
            Em andamento
          </h2>
          <div className="space-y-3">
            {pedidosDaAba.map((pedido) => (
              <PedidoCard
                key={pedido.id}
                pedido={pedido}
                gerente={gerente}
                onAvancar={avancar}
                onPagar={pagar}
                onCancelar={cancelar}
                onReimprimir={reimprimir}
              />
            ))}
            {pedidosDaAba.length === 0 && (
              <p className="rounded-xl bg-white/70 px-4 py-8 text-center text-sm font-semibold text-carvao-suave ring-1 ring-rico-wood/25">
                Nenhum pedido aberto.
              </p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Aba({ ativa, onClick, Icone, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
        ativa ? 'bg-rico-red text-rico-light shadow-brasa' : 'text-carvao-suave hover:bg-carvao/5'
      }`}
    >
      <Icone size={16} /> {children}
    </button>
  );
}

function Input({ rotulo, valor, onChange }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
      />
    </label>
  );
}

function PedidoCard({ pedido, gerente, onAvancar, onPagar, onCancelar, onReimprimir }) {
  const podeAvancar = ['aberto', 'em_preparo'].includes(pedido.status);
  return (
    <article className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10 transition hover:-translate-y-0.5 hover:shadow-media">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl text-carvao">#{pedido.id}</p>
          <p className="truncate text-sm font-bold text-carvao-claro">{pedido.clienteNome}</p>
          {pedido.clienteTelefone && (
            <p className="text-xs font-semibold text-carvao-suave">{pedido.clienteTelefone}</p>
          )}
          {pedido.clienteEndereco && (
            <p className="mt-1 text-xs font-semibold text-carvao-suave">{pedido.clienteEndereco}</p>
          )}
        </div>
        <span className="flex items-center gap-1 rounded-full bg-carvao/8 px-2.5 py-1 text-xs font-bold text-carvao-claro">
          <Clock size={12} /> {STATUS_ROTULO[pedido.status] ?? pedido.status}
        </span>
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
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-carvao/10 pt-3">
        <strong className="text-lg text-rico-red">{moeda(pedido.total)}</strong>
        <div className="flex flex-wrap justify-end gap-2">
          {podeAvancar && (
            <button onClick={() => onAvancar(pedido)} className="rounded-lg bg-carvao px-3 py-2 text-xs font-bold text-rico-light">
              <CheckCircle2 size={14} className="inline" /> Avancar
            </button>
          )}
          <button
            onClick={() => onReimprimir(pedido)}
            className="rounded-lg p-2 text-carvao-suave hover:bg-carvao/10 hover:text-carvao"
            aria-label="Reimprimir comanda"
            title="Reimprimir"
          >
            <Printer size={16} />
          </button>
          {gerente && pedido.status === 'entregue' && (
            <>
              <button onClick={() => onPagar(pedido, 'pix')} className="flex items-center gap-1 rounded-lg bg-rico-red px-3 py-2 text-xs font-bold text-rico-light" title="Pagar com Pix">
                <QrCode size={14} /> Pix
              </button>
              <button onClick={() => onPagar(pedido, 'dinheiro')} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-carvao ring-1 ring-rico-wood/35" title="Pagar em dinheiro">
                <Banknote size={14} /> Dinheiro
              </button>
              <button onClick={() => onPagar(pedido, 'cartao')} className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-carvao ring-1 ring-rico-wood/35" title="Pagar no cartão">
                <CreditCard size={14} /> Cartao
              </button>
            </>
          )}
          {gerente && (
            <button onClick={() => onCancelar(pedido)} className="rounded-lg p-2 text-rico-red hover:bg-rico-red/10" aria-label="Cancelar">
              <Ban size={16} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
