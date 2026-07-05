import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bike, Store, Plus, Minus, Trash2, Send, RefreshCw, CreditCard,
  Banknote, QrCode, ReceiptText, Loader2, BellRing, Search,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { PendenteCard, PedidoCard } from '../components/CardsDelivery';
import { api, moeda, paraCentavos } from '../lib/api';
import { ehGerente, TIPOS_PEDIDO } from '../lib/constantes';
import { notificar } from '../ui/toast';
import { pedirTexto, confirmar } from '../lib/dialogos';
import { useAtualizacaoAoVivo } from '../hooks/useAtualizacaoAoVivo';

const FORM_VAZIO = {
  clienteNome: '', clienteTelefone: '', clienteEndereco: '', bairro: '',
  taxaEntrega: '5,00', pagamento: '', troco: '',
};

const PAGAMENTOS = [
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
];

export default function DeliveryBalcao({ sessao, aoSair }) {
  const [aba, setAba] = useState(TIPOS_PEDIDO.DELIVERY);
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState('');
  const [catAtiva, setCatAtiva] = useState(null);
  const [bairros, setBairros] = useState([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const gerente = ehGerente(sessao);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [catalogo, delivery, balcao, online, publico] = await Promise.all([
        api.produtos.listar(),
        api.pedidos.listarAbertos(TIPOS_PEDIDO.DELIVERY),
        api.pedidos.listarAbertos(TIPOS_PEDIDO.BALCAO),
        api.pedidos.listarPendentes(),
        api.publico.cardapio().catch(() => null),
      ]);
      setProdutos(catalogo);
      setPedidos([...delivery, ...balcao]);
      setPendentes(online);
      setBairros(publico?.loja?.bairros ?? []);
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

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30000); // atualiza "há X min"
    return () => clearInterval(t);
  }, []);

  const categorias = useMemo(() => [...new Set(produtos.map((p) => p.categoria))], [produtos]);
  useEffect(() => {
    if (!catAtiva && categorias.length) setCatAtiva(categorias[0]);
  }, [categorias, catAtiva]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) =>
      termo ? p.nome.toLowerCase().includes(termo) : p.categoria === catAtiva
    );
  }, [produtos, busca, catAtiva]);

  const taxa = aba === TIPOS_PEDIDO.DELIVERY ? paraCentavos(form.taxaEntrega) : 0;
  const totalItens = carrinho.reduce((soma, item) => soma + item.produto.preco * item.quantidade, 0);
  const total = totalItens + taxa;

  const qtdPorProduto = useMemo(() => {
    const m = {};
    for (const item of carrinho) m[item.produto.id] = (m[item.produto.id] || 0) + item.quantidade;
    return m;
  }, [carrinho]);

  function alterarForm(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function selecionarBairro(nome) {
    const b = bairros.find((x) => x.nome === nome);
    setForm((atual) => ({
      ...atual,
      bairro: nome,
      taxaEntrega: b ? (b.taxa / 100).toFixed(2).replace('.', ',') : atual.taxaEntrega,
    }));
  }

  async function buscarClientePorTel() {
    if (form.clienteTelefone.replace(/\D/g, '').length < 8) return;
    setBuscandoCliente(true);
    try {
      const c = await api.pedidos.buscarCliente(form.clienteTelefone);
      if (c) {
        setForm((atual) => ({
          ...atual,
          clienteNome: atual.clienteNome || c.clienteNome || '',
          clienteEndereco: atual.clienteEndereco || c.clienteEndereco || '',
        }));
        notificar.sucesso('Cliente encontrado', c.clienteNome ?? '');
      }
    } catch {
      /* silencioso */
    } finally {
      setBuscandoCliente(false);
    }
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
      pagamentoPretendido: form.pagamento || undefined,
      trocoPara:
        form.pagamento === 'dinheiro' && form.troco.trim() ? paraCentavos(form.troco) : undefined,
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

  async function aceitarPedido(pedido) {
    try {
      await api.pedidos.aceitar(pedido.id);
      notificar.sucesso('Pedido aceito', `#${pedido.id} foi pra cozinha`);
      await recarregar();
    } catch (e) {
      notificar.erro('Nao foi possivel aceitar', e.message);
    }
  }

  async function recusarPedido(pedido) {
    const ok = await confirmar({
      titulo: `Recusar pedido #${pedido.id}?`,
      mensagem: 'O pedido nao vai pra cozinha e o cliente vera como recusado.',
      confirmarRotulo: 'Recusar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.pedidos.recusar(pedido.id);
      notificar.sucesso(`Pedido #${pedido.id} recusado`);
      await recarregar();
    } catch (e) {
      notificar.erro('Nao foi possivel recusar', e.message);
    }
  }

  const pedidosDaAba = pedidos.filter((pedido) => pedido.tipo === aba);
  const totalAberto = pedidos.reduce((s, p) => s + p.total, 0);

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
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/80 px-4 py-3 shadow-suave ring-1 ring-rico-wood/20">
          <p className="text-[11px] font-bold uppercase tracking-wider text-carvao-suave">Em andamento</p>
          <p className="font-display text-2xl text-rico-dark">{pedidos.length}</p>
        </div>
        <div className={`rounded-xl px-4 py-3 shadow-suave ring-1 ${pendentes.length ? 'bg-emerald-50 ring-emerald-200' : 'bg-white/80 ring-rico-wood/20'}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-carvao-suave">Novos online</p>
          <p className="font-display text-2xl text-rico-dark">{pendentes.length}</p>
        </div>
        <div className="col-span-2 rounded-xl bg-white/80 px-4 py-3 shadow-suave ring-1 ring-rico-wood/20 sm:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-carvao-suave">Em aberto</p>
          <p className="font-display text-2xl text-rico-dark">{moeda(totalAberto)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          {pendentes.length > 0 && (
            <section className="rounded-xl border-2 border-emerald-300 bg-emerald-50/80 p-4 shadow-media">
              <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-emerald-700">
                <BellRing size={16} /> Novos pedidos online ({pendentes.length})
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {pendentes.map((p) => (
                  <PendenteCard key={p.id} pedido={p} onAceitar={aceitarPedido} onRecusar={recusarPedido} />
                ))}
              </div>
            </section>
          )}

          <div className="inline-flex rounded-xl bg-white p-1 shadow-suave ring-1 ring-rico-wood/30">
            <Aba ativa={aba === TIPOS_PEDIDO.DELIVERY} onClick={() => setAba(TIPOS_PEDIDO.DELIVERY)} Icone={Bike}>
              Delivery
            </Aba>
            <Aba ativa={aba === TIPOS_PEDIDO.BALCAO} onClick={() => setAba(TIPOS_PEDIDO.BALCAO)} Icone={Store}>
              Balcao
            </Aba>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-3">
              <label className="flex items-center gap-2 rounded-xl bg-white px-4 ring-1 ring-rico-wood/25">
                <Search size={18} className="text-carvao-suave" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar item..."
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm font-semibold text-carvao outline-none placeholder:text-carvao/40"
                />
              </label>
              {!busca && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categorias.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCatAtiva(c)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                        c === catAtiva ? 'bg-rico-red text-rico-light shadow-brasa' : 'bg-white text-carvao-suave ring-1 ring-rico-wood/25'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {produtosFiltrados.map((produto) => {
                  const qtd = qtdPorProduto[produto.id] || 0;
                  return (
                    <button
                      key={produto.id}
                      onClick={() => adicionar(produto)}
                      className={`flex min-h-20 items-center justify-between rounded-xl border bg-white/82 px-4 py-3 text-left shadow-suave transition hover:-translate-y-0.5 hover:shadow-media ${qtd > 0 ? 'border-rico-red/40' : 'border-rico-wood/25 hover:border-rico-red/35'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-carvao">{produto.nome}</span>
                        <span className="text-sm font-semibold text-rico-red">{moeda(produto.preco)}</span>
                      </span>
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rico-red text-rico-light">
                        <Plus size={18} />
                        {qtd > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-carvao px-1 text-xs font-extrabold text-rico-light ring-2 ring-white">
                            {qtd}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                {produtosFiltrados.length === 0 && (
                  <p className="col-span-full rounded-xl bg-white/70 px-4 py-6 text-center text-sm font-semibold text-carvao-suave ring-1 ring-rico-wood/25">
                    Nenhum item encontrado.
                  </p>
                )}
              </div>
            </section>

            <aside className="rounded-xl bg-rico-dark p-4 text-rico-light shadow-media">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rico-light/70">
                <ReceiptText size={16} /> Novo pedido
              </h2>
              <div className="mt-4 space-y-3">
                {aba === TIPOS_PEDIDO.DELIVERY && (
                  <Input
                    rotulo="Telefone"
                    valor={form.clienteTelefone}
                    onChange={(v) => alterarForm('clienteTelefone', v)}
                    onBlur={buscarClientePorTel}
                    dica={buscandoCliente ? 'buscando cliente...' : 'sai do campo p/ buscar pelo histórico'}
                  />
                )}
                <Input rotulo="Cliente" valor={form.clienteNome} onChange={(v) => alterarForm('clienteNome', v)} />
                {aba === TIPOS_PEDIDO.DELIVERY && (
                  <>
                    <Input rotulo="Endereco" valor={form.clienteEndereco} onChange={(v) => alterarForm('clienteEndereco', v)} />
                    {bairros.length > 0 && (
                      <label className="block">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">Bairro</span>
                        <select
                          value={form.bairro}
                          onChange={(e) => selecionarBairro(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
                        >
                          <option value="">Selecione o bairro</option>
                          {bairros.map((b) => (
                            <option key={b.nome} value={b.nome}>{b.nome} — {moeda(b.taxa)}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <Input rotulo="Taxa" valor={form.taxaEntrega} onChange={(v) => alterarForm('taxaEntrega', v)} />
                  </>
                )}

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">Pagamento</span>
                  <div className="mt-1 grid grid-cols-3 gap-1.5">
                    {PAGAMENTOS.map(({ id, rotulo, Icone }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => alterarForm('pagamento', form.pagamento === id ? '' : id)}
                        className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-xs font-bold transition ${
                          form.pagamento === id ? 'border-rico-wood bg-rico-wood/15 text-rico-wood' : 'border-rico-light/15 text-rico-light/60'
                        }`}
                      >
                        <Icone size={16} /> {rotulo}
                      </button>
                    ))}
                  </div>
                  {form.pagamento === 'dinheiro' && (
                    <div className="mt-2">
                      <Input rotulo="Troco para" valor={form.troco} onChange={(v) => alterarForm('troco', v)} />
                    </div>
                  )}
                </div>
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
                agora={agora}
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

function Input({ rotulo, valor, onChange, onBlur, dica }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-rico-light/50">{rotulo}</span>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="mt-1 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
      />
      {dica && <span className="mt-0.5 block text-[10px] font-semibold text-rico-light/40">{dica}</span>}
    </label>
  );
}
