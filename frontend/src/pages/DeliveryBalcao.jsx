import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Bike, Store, Plus, Minus, Trash2, Send, RefreshCw, CreditCard, ListOrdered,
  Banknote, QrCode, Loader2, Search, Zap, CirclePause, CirclePlay, ChevronRight,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { FaixaPendente, PedidoCard } from '../components/CardsDelivery';
import { api, moeda, paraCentavos } from '../lib/api';
import { ehGerente, TIPOS_PEDIDO } from '../lib/constantes';
import { notificar } from '../ui/toast';
import { pedirTexto, confirmar } from '../lib/dialogos';
import { useAtualizacaoAoVivo } from '../hooks/useAtualizacaoAoVivo';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { plural } from '../lib/plural';
import CampoBase from '../ui/Campo';
import AcaoTopo from '../ui/AcaoTopo';
import Segmentado from '../ui/Segmentado';
import Sheet from '../ui/Sheet';

const FORM_VAZIO = {
  clienteNome: '', clienteTelefone: '', clienteEndereco: '', bairro: '',
  taxaEntrega: '5,00', pagamento: '', troco: '', recebido: '', entregueNaHora: false,
};

// Aba extra da tela (não é um tipo de pedido): venda de balcão sem cadastro,
// paga na hora. No banco ela vira um BALCAO com pagoAntecipado=true.
const ABA_RAPIDA = 'RAPIDA';
// Opção "Em andamento" do segmentado (abaixo de 1536px). Não é tipo de pedido.
const OPCAO_FILA = 'FILA';

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
  const [deliveryAtivo, setDeliveryAtivo] = useState(true);
  const [alternandoDelivery, setAlternandoDelivery] = useState(false);
  const [verFila, setVerFila] = useState(false);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const telaMedia = useMediaQuery('(min-width: 1024px)');
  const telaLarga = useMediaQuery('(min-width: 1536px)');
  const gerente = ehGerente(sessao);
  const rapida = aba === ABA_RAPIDA;
  // Em 1536px+ a fila tem coluna própria; o segmentado deixa de ter a opção.
  const mostrandoFila = verFila && !telaLarga;

  // Ao alargar a tela (girar o tablet), o carrinho já está na coluna: fecha o sheet
  useEffect(() => {
    if (telaMedia) setCarrinhoAberto(false);
  }, [telaMedia]);

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
      // A fila desta tela é só Delivery, Balcão e Venda rápida (que é um BALCAO).
      // A API já filtra por tipo; o filtro aqui protege contra mesa entrando por engano.
      setPedidos([...delivery, ...balcao].filter((p) => p.tipo !== TIPOS_PEDIDO.MESA));
      setPendentes(online);
      setBairros(publico?.loja?.bairros ?? []);
      setDeliveryAtivo(publico?.loja?.delivery !== false);
    } catch (e) {
      notificar.erro('Delivery indisponível', e.message);
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
  const recebido = rapida && form.pagamento === 'dinheiro' && form.recebido.trim()
    ? paraCentavos(form.recebido)
    : null;
  const troco = recebido != null && recebido >= total ? recebido - total : null;

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
    if (rapida) return finalizarVendaRapida();
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
      notificar.sucesso('Pedido enviado', `${aba === TIPOS_PEDIDO.DELIVERY ? 'Delivery' : 'Balcão'} ${moeda(total)}`);
      setCarrinho([]);
      setCarrinhoAberto(false);
      setForm(FORM_VAZIO);
      await recarregar();
    } catch (e) {
      notificar.erro('Pedido não enviado', e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function finalizarVendaRapida() {
    if (!form.pagamento) {
      notificar.erro('Forma de pagamento', 'Escolha Pix, Cartão ou Dinheiro');
      return;
    }
    if (recebido != null && recebido < total) {
      notificar.erro('Valor recebido menor que o total', `Faltam ${moeda(total - recebido)}`);
      return;
    }
    setEnviando(true);
    try {
      const venda = await api.pedidos.vendaRapida({
        formaPagamento: form.pagamento,
        valorRecebido: recebido ?? undefined,
        entregueNaHora: form.entregueNaHora,
        itens: carrinho.map((item) => ({
          produtoId: item.produto.id,
          quantidade: item.quantidade,
          observacao: item.observacao?.trim() || undefined,
        })),
      });
      notificar.sucesso(
        `Venda #${venda.id} paga · ${moeda(venda.total)}`,
        venda.troco > 0 ? `TROCO: ${moeda(venda.troco)}` : form.entregueNaHora ? 'Entregue' : 'Comanda enviada pra chapa'
      );
      setCarrinho([]);
      setCarrinhoAberto(false);
      // Mantém a forma de pagamento e o "entregue na hora": a próxima venda
      // costuma ser igual, e isso economiza toques no movimento.
      setForm((atual) => ({ ...FORM_VAZIO, pagamento: atual.pagamento, entregueNaHora: atual.entregueNaHora }));
      await recarregar();
    } catch (e) {
      notificar.erro('Venda não registrada', e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function alternarDelivery() {
    const novo = !deliveryAtivo;
    if (!novo) {
      const ok = await confirmar({
        titulo: 'Pausar o delivery?',
        mensagem: 'O cardápio online vai aceitar só pedidos para retirada até você reativar. Pedidos de entrega já feitos continuam normalmente.',
        confirmarRotulo: 'Pausar delivery',
        perigo: true,
      });
      if (!ok) return;
    }
    setAlternandoDelivery(true);
    try {
      await api.loja.definirDelivery(novo);
      setDeliveryAtivo(novo);
      notificar.sucesso(novo ? 'Delivery reativado' : 'Delivery pausado', novo ? 'Cardápio online aceita entregas' : 'Cardápio online: só retirada');
    } catch (e) {
      notificar.erro('Não foi possível alterar o delivery', e.message);
    } finally {
      setAlternandoDelivery(false);
    }
  }

  async function avancar(pedido) {
    const proximo = pedido.status === 'aberto' ? 'em_preparo' : 'entregue';
    try {
      await api.pedidos.atualizarStatus(pedido.id, proximo);
      await recarregar();
    } catch (e) {
      notificar.erro('Status não atualizado', e.message);
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
      notificar.erro('Não foi possível reimprimir', e.message);
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
      notificar.erro('Não foi possível aceitar', e.message);
    }
  }

  async function recusarPedido(pedido) {
    const ok = await confirmar({
      titulo: `Recusar pedido #${pedido.id}?`,
      mensagem: 'O pedido não vai pra cozinha e o cliente verá como recusado.',
      confirmarRotulo: 'Recusar',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.pedidos.recusar(pedido.id);
      notificar.sucesso(`Pedido #${pedido.id} recusado`);
      await recarregar();
    } catch (e) {
      notificar.erro('Não foi possível recusar', e.message);
    }
  }

  // Venda rápida já está paga: não é dinheiro "em aberto"
  const totalAberto = pedidos.reduce((s, p) => s + (p.pagoAntecipado ? 0 : p.total), 0);
  const qtdNoCarrinho = carrinho.reduce((s, item) => s + item.quantidade, 0);

  const opcoesSegmentado = [
    ...(gerente ? [{ valor: ABA_RAPIDA, rotulo: 'Venda rápida', curto: 'Rápida', icone: Zap }] : []),
    { valor: TIPOS_PEDIDO.DELIVERY, rotulo: 'Delivery', icone: Bike },
    { valor: TIPOS_PEDIDO.BALCAO, rotulo: 'Balcão', icone: Store },
    ...(telaLarga
      ? []
      : [{ valor: OPCAO_FILA, rotulo: 'Em andamento', curto: 'Fila', icone: ListOrdered, contador: pedidos.length }]),
  ];

  function escolherOpcao(valor) {
    if (valor === OPCAO_FILA) {
      setVerFila(true);
      return;
    }
    setVerFila(false);
    setAba(valor);
  }

  const acoes = (
    <div className="flex items-center gap-2">
      {gerente && (
        <AcaoTopo
          icone={deliveryAtivo ? CirclePause : CirclePlay}
          rotulo={deliveryAtivo ? 'Pausar delivery' : 'Delivery pausado · reativar'}
          variante={deliveryAtivo ? 'neutra' : 'atencao'}
          aria-pressed={!deliveryAtivo}
          disabled={alternandoDelivery}
          onClick={alternarDelivery}
        />
      )}
      <AcaoTopo icone={RefreshCw} rotulo="Atualizar" variante="escura" girando={carregando} onClick={recarregar} />
    </div>
  );

  /* ---------- carrinho + formulário (coluna escura no desktop, sheet claro no celular) ---------- */
  const tituloPainel = rapida ? 'Venda rápida' : aba === TIPOS_PEDIDO.DELIVERY ? 'Novo delivery' : 'Novo balcão';
  const IconeTitulo = rapida ? Zap : aba === TIPOS_PEDIDO.DELIVERY ? Bike : Store;

  const botaoEnviar = (escuro) => (
    <button
      type="button"
      onClick={criarPedido}
      disabled={enviando}
      className={`flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-rico-red px-4 text-base font-semibold text-white transition-colors hover:bg-vinho-profundo disabled:cursor-not-allowed ${
        escuro ? 'disabled:bg-creme/14 disabled:text-creme/70' : 'disabled:bg-creme-escuro disabled:text-carvao-suave'
      }`}
    >
      {enviando ? (
        <>
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Enviando…
        </>
      ) : rapida ? (
        <>
          <Zap size={18} aria-hidden="true" /> Receber {moeda(total)}
        </>
      ) : (
        <>
          <Send size={18} aria-hidden="true" /> Enviar pedido
        </>
      )}
    </button>
  );

  function painelCarrinho(escuro) {
    const t = escuro
      ? {
          rotulo: 'text-creme/75',
          divisor: 'border-creme/10',
          texto: 'text-creme',
          suave: 'text-creme/75',
          qtd: 'text-brasa-clara',
          stepper: 'bg-creme/10 text-creme',
          stepperMenos: 'hover:bg-creme/10',
          obs: 'bg-carvao-claro/40 text-creme ring-creme/20 placeholder:text-creme/70 focus:ring-brasa-clara',
          pag: (ativo) =>
            ativo ? 'border-creme bg-creme text-carvao' : 'border-creme/20 text-creme/85 hover:border-creme/40',
          vazio: 'border-creme/14 text-creme/75',
          caixa: 'bg-creme/6 ring-creme/12',
          caixaCheck: (on) => (on ? 'bg-rico-red ring-rico-red text-white' : 'ring-creme/60'),
          troco: 'text-ok-claro',
        }
      : {
          rotulo: 'text-carvao-suave',
          divisor: 'border-creme-escuro',
          texto: 'text-carvao',
          suave: 'text-carvao-suave',
          qtd: 'text-rico-red',
          stepper: 'bg-creme-escuro text-carvao',
          stepperMenos: 'hover:bg-carvao/6',
          obs: 'bg-white text-carvao ring-rico-wood/45 focus:ring-rico-red',
          pag: (ativo) =>
            ativo ? 'border-rico-red bg-erro-fundo text-rico-red' : 'border-rico-wood/35 bg-white text-carvao hover:border-rico-wood',
          vazio: 'border-rico-wood/35 text-carvao-suave',
          caixa: 'bg-white ring-rico-wood/35',
          caixaCheck: (on) => (on ? 'bg-rico-red ring-rico-red text-white' : 'ring-rico-wood'),
          troco: 'text-ok',
        };
    const tom = escuro ? 'escuro' : 'claro';

    return (
      <div className={`space-y-4 ${t.texto}`}>
        {/* Itens primeiro: é o que o operador confere antes de tudo */}
        {carrinho.length === 0 ? (
          <p className={`rounded-xl border border-dashed px-4 py-5 text-center text-sm ${t.vazio}`}>
            Toque nos produtos para montar o pedido.
          </p>
        ) : (
          <ul className={`divide-y ${escuro ? 'divide-creme/10' : 'divide-creme-escuro'}`}>
            {carrinho.map((item, indice) => (
              <li key={`${item.produto.id}-${indice}`} className="py-2.5 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <p data-nome-produto className="min-w-0 text-sm font-semibold leading-snug">
                    <span className={`tabular-nums ${t.qtd}`}>{item.quantidade}×</span> {item.produto.nome}
                  </p>
                  <span className="shrink-0 text-sm tabular-nums">{moeda(item.produto.preco * item.quantidade)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className={`flex h-11 shrink-0 items-center rounded-lg ${t.stepper}`}>
                    <button
                      type="button"
                      onClick={() => mudarQuantidade(indice, -1)}
                      className={`grid h-11 w-11 place-items-center rounded-lg ${t.stepperMenos}`}
                      aria-label={item.quantidade === 1 ? `Tirar ${item.produto.nome}` : `Diminuir ${item.produto.nome}`}
                    >
                      {item.quantidade === 1 ? <Trash2 size={17} aria-hidden="true" /> : <Minus size={17} aria-hidden="true" />}
                    </button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantidade}</span>
                    <button
                      type="button"
                      onClick={() => mudarQuantidade(indice, 1)}
                      className="grid h-11 w-11 place-items-center rounded-lg bg-rico-red text-white hover:bg-vinho-profundo"
                      aria-label={`Mais um ${item.produto.nome}`}
                    >
                      <Plus size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <label className="sr-only" htmlFor={`obs-${tom}-${indice}`}>
                    Observação de {item.produto.nome}
                  </label>
                  <input
                    id={`obs-${tom}-${indice}`}
                    value={item.observacao}
                    onChange={(e) => mudarObservacao(indice, e.target.value)}
                    placeholder="Obs.: sem cebola…"
                    maxLength={120}
                    className={`min-h-11 min-w-0 flex-1 rounded-lg px-3 text-sm outline-none ring-1 ring-inset focus:ring-2 ${t.obs}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {aba === TIPOS_PEDIDO.DELIVERY && (
          <Input
            tom={tom}
            rotulo="Telefone"
            valor={form.clienteTelefone}
            onChange={(v) => alterarForm('clienteTelefone', v)}
            onBlur={buscarClientePorTel}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            dica={buscandoCliente ? 'Buscando cliente…' : 'Ao sair do campo, busca o cliente pelo histórico'}
          />
        )}
        {!rapida && (
          <Input tom={tom} rotulo="Cliente" valor={form.clienteNome} onChange={(v) => alterarForm('clienteNome', v)} autoComplete="off" />
        )}
        {aba === TIPOS_PEDIDO.DELIVERY && (
          <>
            <Input tom={tom} rotulo="Endereço" valor={form.clienteEndereco} onChange={(v) => alterarForm('clienteEndereco', v)} autoComplete="off" />
            <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-3">
              {bairros.length > 0 ? (
                <CampoBase
                  tom={tom}
                  como="select"
                  rotulo="Bairro"
                  value={form.bairro}
                  onChange={(e) => selecionarBairro(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {bairros.map((b) => (
                    <option key={b.nome} value={b.nome}>
                      {b.nome} — {moeda(b.taxa)}
                    </option>
                  ))}
                </CampoBase>
              ) : (
                <span />
              )}
              <Input
                tom={tom}
                rotulo="Taxa (R$)"
                valor={form.taxaEntrega}
                onChange={(v) => alterarForm('taxaEntrega', v)}
                inputMode="decimal"
              />
            </div>
          </>
        )}

        <fieldset>
          <legend className={`mb-1.5 text-rotulo font-semibold ${t.rotulo}`}>Pagamento</legend>
          <div className="grid grid-cols-3 gap-2">
            {PAGAMENTOS.map(({ id, rotulo, Icone }) => (
              <button
                key={id}
                type="button"
                aria-pressed={form.pagamento === id}
                onClick={() => alterarForm('pagamento', form.pagamento === id ? '' : id)}
                className={`flex min-h-13 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-rotulo font-semibold transition-colors ${t.pag(form.pagamento === id)}`}
              >
                <Icone size={18} aria-hidden="true" /> {rotulo}
              </button>
            ))}
          </div>
          {form.pagamento === 'dinheiro' && !rapida && (
            <div className="mt-3">
              <Input tom={tom} rotulo="Troco para" valor={form.troco} onChange={(v) => alterarForm('troco', v)} inputMode="decimal" />
            </div>
          )}
          {form.pagamento === 'dinheiro' && rapida && (
            <div className="mt-3">
              <Input
                tom={tom}
                rotulo="Valor recebido (opcional)"
                valor={form.recebido}
                onChange={(v) => alterarForm('recebido', v)}
                inputMode="decimal"
                dica={
                  recebido == null
                    ? 'Preencha para calcular o troco'
                    : troco != null
                      ? `Troco: ${moeda(troco)}`
                      : `Faltam ${moeda(total - recebido)}`
                }
              />
            </div>
          )}
        </fieldset>

        {rapida && (
          <label
            className={`relative flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-inset has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-rico-wood ${t.caixa}`}
          >
            {/* O input nativo cobre a linha inteira (alvo de toque = a linha);
                a caixa visível só desenha o estado. */}
            <input
              type="checkbox"
              checked={form.entregueNaHora}
              onChange={(e) => alterarForm('entregueNaHora', e.target.checked)}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-lg opacity-0"
            />
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-2 ${t.caixaCheck(form.entregueNaHora)}`}
            >
              {form.entregueNaHora && <Check size={14} strokeWidth={3} />}
            </span>
            <span className={`text-rotulo ${t.suave}`}>
              <strong className={`block text-sm ${t.texto}`}>Entregue na hora</strong>
              Ex.: só bebida. Não imprime comanda nem vai pra chapa.
            </span>
          </label>
        )}

        <dl className={`space-y-1 border-t pt-3 text-sm tabular-nums ${t.divisor}`}>
          <div className={`flex justify-between ${t.suave}`}>
            <dt>Itens</dt>
            <dd>{moeda(totalItens)}</dd>
          </div>
          {taxa > 0 && (
            <div className={`flex justify-between ${t.suave}`}>
              <dt>Entrega{form.bairro ? ` (${form.bairro})` : ''}</dt>
              <dd>{moeda(taxa)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-1 text-lg font-bold">
            <dt>Total</dt>
            <dd className={escuro ? 'text-brasa-clara' : 'text-carvao'}>{moeda(total)}</dd>
          </div>
          {rapida && troco != null && troco > 0 && (
            <div className="flex justify-between text-lg font-bold">
              <dt>Troco</dt>
              <dd className={t.troco}>{moeda(troco)}</dd>
            </div>
          )}
        </dl>
      </div>
    );
  }

  /* ---------- produtos ---------- */
  const produtosView = (
    <>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {!busca && (
          <nav
            aria-label="Categorias"
            className="sem-barra -mr-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pr-8 sm:mr-0 sm:pr-6"
            style={{ maskImage: 'linear-gradient(90deg, #000 85%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 85%, transparent)' }}
          >
            {categorias.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCatAtiva(c)}
                aria-pressed={c === catAtiva}
                className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors ${
                  c === catAtiva ? 'border-carvao bg-carvao text-creme' : 'border-rico-wood/40 bg-white text-carvao-suave hover:text-carvao'
                }`}
              >
                {c}
              </button>
            ))}
          </nav>
        )}
        <label className={`flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 ring-1 ring-inset ring-rico-wood/45 focus-within:ring-2 focus-within:ring-rico-red ${busca ? 'flex-1' : 'sm:w-60 sm:shrink-0 2xl:w-48'}`}>
          <Search size={18} className="shrink-0 text-carvao-suave" aria-hidden="true" />
          <span className="sr-only">Buscar item</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item"
            className="min-w-0 flex-1 bg-transparent text-sm text-carvao outline-none"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(176px,calc(50%-5px)),1fr))]">
        {produtosFiltrados.map((produto) => {
          const qtd = qtdPorProduto[produto.id] || 0;
          return (
            <button
              key={produto.id}
              type="button"
              onClick={() => adicionar(produto)}
              aria-label={`${produto.nome}, ${moeda(produto.preco)}${qtd ? `, ${qtd} no pedido` : ''}`}
              className={`relative flex min-h-[104px] min-w-0 flex-col justify-between rounded-xl border p-3.5 text-left transition-colors ${
                qtd > 0 ? 'border-rico-red/45 bg-erro-fundo/40' : 'border-rico-wood/30 bg-white hover:border-rico-wood'
              }`}
            >
              {qtd > 0 && (
                <span className="absolute right-2.5 top-2.5 grid h-6 min-w-6 place-items-center rounded-full bg-carvao px-1.5 text-xs font-bold text-white tabular-nums">
                  {qtd}
                </span>
              )}
              <span data-nome-produto className={`block text-sm font-semibold leading-snug text-carvao ${qtd ? 'pr-7' : ''}`}>
                {produto.nome}
              </span>
              <span className="mt-2.5 flex items-end justify-between gap-2">
                <span className="text-sm font-bold text-rico-red tabular-nums">{moeda(produto.preco)}</span>
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rico-red text-white">
                  <Plus size={18} />
                </span>
              </span>
            </button>
          );
        })}
        {produtosFiltrados.length === 0 && (
          <div className="col-span-full rounded-xl border border-rico-wood/30 bg-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-carvao">
              {busca.trim() ? `Nenhum item encontrado para “${busca.trim()}”.` : 'Nenhum produto nesta categoria.'}
            </p>
            {busca.trim() && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="mt-3 min-h-11 rounded-lg px-4 text-sm font-semibold text-carvao ring-1 ring-inset ring-rico-wood/45 hover:bg-creme-escuro"
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  /* ---------- fila (em andamento) ---------- */
  const filaView = (colunas) => (
    <section aria-label="Pedidos em andamento">
      <p className="text-rotulo font-semibold text-carvao-suave tabular-nums">
        {plural(pedidos.length, 'pedido', 'pedidos')} · {moeda(totalAberto)} em aberto
      </p>
      <div className={`mt-3 grid gap-3 ${colunas ? 'md:grid-cols-2' : ''}`}>
        {pedidos.map((pedido) => (
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
        {pedidos.length === 0 && (
          <p className="rounded-xl border border-rico-wood/30 bg-white px-4 py-8 text-center text-sm text-carvao-suave">
            Nenhum pedido em andamento.
          </p>
        )}
      </div>
    </section>
  );

  return (
    <AppShell titulo="Delivery e Balcão" tituloCurto="Delivery" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      <div className="space-y-3">
        {pendentes.map((p) => (
          <FaixaPendente key={p.id} pedido={p} onAceitar={aceitarPedido} onRecusar={recusarPedido} />
        ))}
        {!deliveryAtivo && (
          <p className="flex items-start gap-2 rounded-xl border border-atencao-borda bg-atencao-fundo px-4 py-3 text-sm text-atencao">
            <CirclePause size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Delivery pausado.</strong> O cardápio online está aceitando só retirada.
              {gerente ? ' Use o botão no topo para reativar.' : ''}
            </span>
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start 2xl:grid-cols-[minmax(480px,1fr)_360px_minmax(360px,440px)]">
        <section className="min-w-0">
          <Segmentado
            rotulo="Tipo de venda"
            opcoes={opcoesSegmentado}
            valor={mostrandoFila ? OPCAO_FILA : aba}
            aoMudar={escolherOpcao}
          />
          {mostrandoFila ? <div className="mt-4">{filaView(true)}</div> : produtosView}
        </section>

        <aside className="hidden max-h-[calc(100dvh-104px)] overflow-y-auto overscroll-contain rounded-3xl bg-carvao p-5 text-creme lg:sticky lg:top-[88px] lg:block">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <IconeTitulo size={20} aria-hidden="true" className="text-brasa-clara" /> {tituloPainel}
          </h2>
          {painelCarrinho(true)}
          <div className="mt-4">{botaoEnviar(true)}</div>
        </aside>

        <section className="hidden 2xl:block">
          <h2 className="mb-1 text-xl font-bold text-carvao">Em andamento</h2>
          {filaView(false)}
        </section>
      </div>

      {/* Celular/tablet em pé: o carrinho vira uma barra fixa que abre um sheet */}
      {!telaMedia && !mostrandoFila && carrinho.length > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] z-20 lg:hidden">
          <button
            type="button"
            onClick={() => setCarrinhoAberto(true)}
            className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl bg-carvao py-2 pl-4 pr-2 text-left text-creme shadow-media"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-rotulo text-creme/80">{plural(qtdNoCarrinho, 'item', 'itens')}</span>
              <span className="block text-lg font-bold leading-tight tabular-nums">{moeda(total)}</span>
            </span>
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-rico-red px-4 text-sm font-semibold text-white">
              Revisar e enviar <ChevronRight size={18} aria-hidden="true" />
            </span>
          </button>
        </div>
      )}

      <Sheet
        aberto={carrinhoAberto}
        aoFechar={() => setCarrinhoAberto(false)}
        titulo={tituloPainel}
        subtitulo={`${plural(qtdNoCarrinho, 'item', 'itens')} · ${moeda(total)}`}
        rodape={botaoEnviar(false)}
      >
        {painelCarrinho(false)}
      </Sheet>
    </AppShell>
  );
}

function Input({ tom = 'escuro', rotulo, valor, onChange, onBlur, dica, ...resto }) {
  return (
    <CampoBase
      tom={tom}
      rotulo={rotulo}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      dica={dica}
      {...resto}
    />
  );
}
