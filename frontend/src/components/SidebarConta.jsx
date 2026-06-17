import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, QrCode, Banknote, CreditCard, Receipt, HandPlatter, Armchair,
  Loader2, Trash2, Printer, Undo2, BellRing, CircleDollarSign,
} from 'lucide-react';
import { api, moeda, paraCentavos } from '../lib/api';
import { notificar } from '../ui/toast';
import { confirmar } from '../lib/dialogos';
import { ehGerente, STATUS_MESA } from '../lib/constantes';

const FORMAS = [
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
  { id: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
];

/*
 * Painel da conta da mesa (Salão / Desktop).
 * Extrato vem do servidor (GET /mesas/:id/conta): comandas, taxa, parciais
 * e saldo devedor. Pagamento parcial é EXCLUSIVO do gerente — a mesa só
 * libera quando o saldo zera.
 */
export default function SidebarConta({ mesa, aoFechar, aoAtualizar, sessao }) {
  const [conta, setConta] = useState(null);
  const [forma, setForma] = useState(null);
  const [valor, setValor] = useState('');
  const [processando, setProcessando] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [itemArmado, setItemArmado] = useState(null);
  const painelRef = useRef(null);

  const aberta = Boolean(mesa);
  const gerente = ehGerente(sessao);

  const carregarConta = useCallback(async () => {
    if (!mesa) return;
    try {
      setConta(await api.mesas.conta(mesa.id));
    } catch (e) {
      notificar.erro('Não foi possível carregar a conta', e.message);
    }
  }, [mesa?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setConta(null);
    setForma(null);
    setValor('');
    setCancelandoId(null);
    setMotivo('');
    setItemArmado(null);
    carregarConta();
  }, [mesa?.id, carregarConta]);

  // Acessibilidade: Escape fecha, foco entra no painel
  useEffect(() => {
    if (!aberta) return;
    painelRef.current?.focus();
    const aoTeclar = (e) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberta, aoFechar]);

  async function executar(acao, mensagemErro) {
    try {
      await acao();
      await Promise.all([carregarConta(), aoAtualizar()]);
    } catch (e) {
      notificar.erro(mensagemErro, e.message);
      await Promise.all([carregarConta(), aoAtualizar()]);
    }
  }

  const alternarTaxa = () =>
    executar(
      () => api.mesas.definirTaxa(mesa.id, !conta?.taxaAtiva),
      'Não foi possível alterar a taxa'
    );

  const preConta = () =>
    executar(async () => {
      const r = await api.mesas.preConta(mesa.id);
      notificar.brasa(
        `Pré-conta da mesa ${mesa.numero} impressa`,
        `Total ${moeda(r.totalDevido)} — aguardando pagamento`
      );
    }, 'Não foi possível emitir a pré-conta');

  const reabrirConsumo = () =>
    executar(async () => {
      await api.mesas.atualizarStatus(mesa.id, STATUS_MESA.OCUPADA);
      notificar.info(`Mesa ${mesa.numero} reaberta`, 'Garçom pode lançar pedidos de novo');
    }, 'Não foi possível reabrir a mesa');

  const removerItem = (pedidoId, item) =>
    executar(async () => {
      await api.pedidos.removerItem(pedidoId, item.id);
      setItemArmado(null);
      notificar.sucesso('Item removido', `${item.quantidade}× ${item.produto.nome}`);
    }, 'Não foi possível remover o item');

  const reimprimir = (pedidoId) =>
    executar(async () => {
      await api.pedidos.imprimir(pedidoId);
      notificar.brasa('Cupom reenviado', `Comanda #${pedidoId} de volta para a impressora`);
    }, 'Não foi possível reimprimir');

  async function removerMesa() {
    const ok = await confirmar({
      titulo: `Remover a mesa ${mesa.numero}?`,
      mensagem: 'Só funciona se estiver livre e sem histórico de pedidos.',
      confirmarRotulo: 'Remover',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.mesas.remover(mesa.id);
      notificar.sucesso('Mesa removida', `Mesa ${mesa.numero}`);
      await aoAtualizar();
      aoFechar();
    } catch (e) {
      notificar.erro('Não foi possível remover', e.message);
    }
  }

  async function confirmarCancelamento(pedidoId) {
    if (motivo.trim().length < 3) {
      notificar.erro('Motivo obrigatório', 'Descreva por que a comanda está sendo cancelada');
      return;
    }
    await executar(async () => {
      await api.pedidos.cancelar(pedidoId, motivo.trim());
      setCancelandoId(null);
      setMotivo('');
      notificar.sucesso(`Comanda #${pedidoId} cancelada`, 'Registrado na auditoria');
    }, 'Não foi possível cancelar');
  }

  async function lancarPagamento() {
    const centavos = paraCentavos(valor);
    if (!forma || centavos <= 0 || processando) return;
    setProcessando(true);
    try {
      const r = await api.mesas.pagar(mesa.id, { forma, valor: centavos });
      if (r.liberada) {
        notificar.sucesso(
          `Mesa ${mesa.numero} quitada e liberada!`,
          r.troco > 0 ? `Troco de ${moeda(r.troco)} em dinheiro` : 'Saldo zerado'
        );
        await aoAtualizar();
        aoFechar();
      } else {
        notificar.info(
          `Parcial de ${moeda(r.valorAplicado)} registrado`,
          `Saldo devedor: ${moeda(r.saldoDevedor)}`
        );
        setForma(null);
        setValor('');
        await Promise.all([carregarConta(), aoAtualizar()]);
      }
    } catch (e) {
      notificar.erro('Pagamento não registrado', e.message);
      await Promise.all([carregarConta(), aoAtualizar()]);
    } finally {
      setProcessando(false);
    }
  }

  const comandas = conta?.comandas ?? [];
  const saldo = conta?.saldoDevedor ?? 0;
  const valorCentavos = paraCentavos(valor);
  const trocoPrevisto = forma === 'dinheiro' && valorCentavos > saldo ? valorCentavos - saldo : 0;
  const valorInvalido = forma && forma !== 'dinheiro' && valorCentavos > saldo;

  return (
    <>
      {aberta && (
        <div
          className="fixed inset-0 z-30 bg-carvao/20 backdrop-blur-[2px] lg:hidden"
          onClick={aoFechar}
        />
      )}

      <aside
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={mesa ? `Conta da mesa ${mesa.numero}` : 'Conta da mesa'}
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-rico-light
          shadow-flutuante outline-none transition-transform duration-300
          ${aberta ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!aberta}
      >
        {!mesa ? null : (
          <>
            <header className="bg-rico-red px-6 py-5 text-rico-light">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-rico-light/70">
                    {mesa.status === STATUS_MESA.AGUARDANDO_PAGAMENTO
                      ? '⏳ Aguardando pagamento'
                      : 'Conta da mesa'}
                  </p>
                  <h2 className="font-display text-4xl leading-tight">
                    Mesa {String(mesa.numero).padStart(2, '0')}
                  </h2>
                </div>
                <button
                  onClick={aoFechar}
                  className="rounded-xl p-2 text-rico-light/70 transition hover:bg-rico-light/10 hover:text-rico-light"
                  aria-label="Fechar painel"
                >
                  <X size={22} />
                </button>
              </div>
            </header>

            {/* Consumo */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!conta ? (
                <p className="py-10 text-center text-sm text-carvao-suave">Carregando conta…</p>
              ) : comandas.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Armchair size={44} className="text-emerald-500/40" />
                  <p className="mt-3 font-bold text-carvao-claro">Mesa livre</p>
                  <p className="mt-1 text-sm text-carvao-suave">Nenhum consumo registrado.</p>
                  {gerente && mesa.status === STATUS_MESA.LIVRE && (
                    <button
                      onClick={removerMesa}
                      className="mt-5 flex items-center gap-2 rounded-xl border-2 border-rico-red/30 px-4 py-2 text-sm font-bold text-rico-red transition hover:bg-rico-red/5"
                    >
                      <Trash2 size={15} /> Remover esta mesa
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  {comandas.map((pedido) => (
                    <section key={pedido.id} className="rounded-xl border border-rico-wood/25 bg-white/75 p-4 shadow-suave">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-carvao-suave">
                          <Receipt size={13} /> Comanda #{pedido.id}
                          <span className="font-normal normal-case">
                            ·{' '}
                            {new Date(pedido.criadoEm).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </h3>
                        {gerente && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => reimprimir(pedido.id)}
                              className="rounded-md p-1.5 text-carvao-suave transition hover:bg-carvao/10 hover:text-carvao"
                              aria-label={`Reimprimir comanda ${pedido.id}`}
                              title="Reimprimir cupom"
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setCancelandoId(cancelandoId === pedido.id ? null : pedido.id);
                                setMotivo('');
                              }}
                              className="rounded-md p-1.5 text-carvao-suave transition hover:bg-rico-red/10 hover:text-rico-red"
                              aria-label={`Cancelar comanda ${pedido.id}`}
                              title="Cancelar comanda"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {cancelandoId === pedido.id && (
                        <div className="mb-3 rounded-xl border border-rico-red/30 bg-rico-red/5 p-3">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-rico-red">
                            Motivo do cancelamento
                          </label>
                          <input
                            type="text"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="ex: cliente desistiu, lançamento errado…"
                            className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm outline-none ring-1 ring-carvao/15 focus:ring-rico-red"
                            autoFocus
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => confirmarCancelamento(pedido.id)}
                              className="rounded-lg bg-rico-red px-3 py-1.5 text-xs font-bold text-rico-light transition hover:bg-vinho-profundo"
                            >
                              Confirmar cancelamento
                            </button>
                            <button
                              onClick={() => setCancelandoId(null)}
                              className="rounded-lg px-3 py-1.5 text-xs font-bold text-carvao-suave hover:bg-carvao/5"
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      )}

                      <ul className="space-y-2">
                        {pedido.itens.map((item) => (
                          <li key={item.id} className="flex items-baseline justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-carvao">
                                <span className="text-rico-red">{item.quantidade}×</span>{' '}
                                {item.produto.nome}
                              </p>
                              {item.observacao && (
                                <p className="truncate text-xs italic text-carvao-suave">
                                  “{item.observacao}”
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-carvao-claro">
                              {moeda(item.precoUnitario * item.quantidade)}
                            </span>
                            {gerente && (
                              <button
                                onClick={() =>
                                  itemArmado === item.id
                                    ? removerItem(pedido.id, item)
                                    : setItemArmado(item.id)
                                }
                                className={`shrink-0 rounded-md p-1 text-xs font-bold transition ${
                                  itemArmado === item.id
                                    ? 'bg-rico-red px-2 text-rico-light'
                                    : 'text-carvao/30 hover:bg-rico-red/10 hover:text-rico-red'
                                }`}
                                aria-label={`Remover ${item.produto.nome}`}
                                title="Remover item (toque duas vezes)"
                              >
                                {itemArmado === item.id ? 'remover?' : <X size={13} />}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}

                  {/* Pagamentos parciais já registrados */}
                  {conta.pagamentosParciais.length > 0 && (
                    <section className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                        <CircleDollarSign size={13} /> Pagamentos parciais
                      </h3>
                      <ul className="mt-1.5 space-y-1">
                        {conta.pagamentosParciais.map((p) => (
                          <li key={p.id} className="flex justify-between text-[13px] font-semibold text-emerald-800">
                            <span className="capitalize">{p.forma}</span>
                            <span>{moeda(p.valor)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé: totais e pagamento */}
            {conta && comandas.length > 0 && (
              <footer className="border-t border-rico-wood/25 bg-rico-light px-6 pb-5 pt-4 shadow-[0_-12px_30px_rgb(63_43_29/0.08)]">
                {mesa.status !== STATUS_MESA.AGUARDANDO_PAGAMENTO ? (
                  <button
                    onClick={preConta}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl
                      border border-rico-wood bg-rico-wood/12 py-3 text-sm font-bold text-rico-dark
                      transition hover:bg-rico-wood/22"
                  >
                    <BellRing size={15} /> Imprimir pré-conta (aguardar pagamento)
                  </button>
                ) : (
                  gerente && (
                    <button
                      onClick={reabrirConsumo}
                      className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl
                        border border-rico-wood/45 py-3 text-sm font-bold text-carvao-claro transition
                        hover:border-carvao/40"
                    >
                      <Undo2 size={15} /> Reabrir consumo da mesa
                    </button>
                  )
                )}

                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-carvao-claro">
                    <dt>Subtotal</dt>
                    <dd className="font-semibold">{moeda(conta.subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between text-carvao-claro">
                    <dt>
                      <button
                        onClick={alternarTaxa}
                        disabled={!gerente}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1 text-[13px]
                          font-bold transition disabled:cursor-not-allowed ${
                            conta.taxaAtiva
                              ? 'bg-madeira-gradiente text-rico-dark shadow-suave'
                              : 'bg-rico-wood/12 text-carvao-suave hover:bg-rico-wood/20'
                          }`}
                      >
                        <HandPlatter size={14} />
                        Taxa de serviço 10%
                      </button>
                    </dt>
                    <dd className="font-semibold">{conta.taxaAtiva ? moeda(conta.taxa) : '—'}</dd>
                  </div>
                  {conta.pago > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <dt className="font-semibold">Pago parcialmente</dt>
                      <dd className="font-semibold">− {moeda(conta.pago)}</dd>
                    </div>
                  )}
                  <div className="mt-3 rounded-xl border border-rico-wood/35 bg-white px-4 py-3 shadow-suave">
                    <div className="flex items-baseline justify-between">
                      <dt className="font-bold uppercase tracking-wide text-carvao">Saldo devedor</dt>
                      <dd className="font-display text-3xl text-rico-red">{moeda(saldo)}</dd>
                    </div>
                  </div>
                </dl>

                {gerente ? (
                  <>
                    {/* Lançar pagamento (parcial ou total) */}
                    <div className="mt-4 grid grid-cols-3 gap-2.5">
                      {FORMAS.map(({ id, rotulo, Icone }) => (
                        <button
                          key={id}
                          onClick={() => {
                            setForma(id);
                            setValor((saldo / 100).toFixed(2).replace('.', ','));
                          }}
                          className={`flex flex-col items-center gap-1 rounded-xl border py-3
                            text-sm font-bold transition active:scale-[0.97] ${
                              forma === id
                                ? 'border-rico-red bg-rico-red text-rico-light shadow-brasa'
                                : 'border-rico-wood/65 bg-white text-carvao-claro hover:border-rico-red/45'
                            }`}
                        >
                          <Icone size={20} strokeWidth={2} />
                          {rotulo}
                        </button>
                      ))}
                    </div>

                    {forma && (
                      <div className="mt-3 rounded-xl bg-white p-3 shadow-suave ring-1 ring-rico-wood/30">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-carvao-suave">
                          Valor recebido em {FORMAS.find((f) => f.id === forma).rotulo}
                        </label>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-sm font-bold text-carvao-suave">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            placeholder="0,00"
                            className="w-full bg-transparent text-lg font-bold text-carvao outline-none placeholder:text-carvao/25"
                            autoFocus
                          />
                        </div>
                        <p
                          className={`mt-1 text-[13px] font-bold ${
                            valorInvalido ? 'text-rico-red' : 'text-carvao-suave'
                          }`}
                        >
                          {valorInvalido
                            ? 'Acima do saldo — troco só em dinheiro'
                            : trocoPrevisto > 0
                              ? `Troco previsto: ${moeda(trocoPrevisto)}`
                              : valorCentavos < saldo && valorCentavos > 0
                                ? `Pagamento parcial — restarão ${moeda(saldo - valorCentavos)}`
                                : 'Valor cobre o saldo'}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={lancarPagamento}
                      disabled={!forma || valorCentavos <= 0 || valorInvalido || processando}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl
                        bg-rico-red py-3.5 text-base font-bold text-rico-light shadow-brasa transition
                        hover:bg-vinho-profundo active:scale-[0.99]
                        disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                      {processando ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> Processando…
                        </>
                      ) : valorCentavos >= saldo && valorCentavos > 0 ? (
                        <>Quitar conta · {moeda(saldo)}</>
                      ) : (
                        <>Registrar pagamento parcial</>
                      )}
                    </button>
                  </>
                ) : (
                  <p className="mt-3 rounded-xl bg-carvao/5 px-3 py-2.5 text-center text-[13px] font-semibold text-carvao-suave">
                    Pagamento é processado pelo gerente no caixa
                  </p>
                )}
              </footer>
            )}
          </>
        )}
      </aside>
    </>
  );
}
