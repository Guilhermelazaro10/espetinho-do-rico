import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote, CalendarDays, CreditCard, Landmark, LockKeyhole, QrCode,
  Receipt, RefreshCw, ScrollText, TrendingUp, Trophy, Users,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, moeda, moedaCurta } from '../lib/api';
import { dataHoraLoja, diaMes } from '../lib/datas';
import { notificar } from '../ui/toast';
import { plural } from '../lib/plural';
import AcaoTopo from '../ui/AcaoTopo';

const PERIODOS = [
  { id: 'dia', rotulo: 'Hoje' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
];

const FORMAS = [
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
];

export default function Financeiro({ sessao, aoSair }) {
  const [dados, setDados] = useState({});
  const [auditoria, setAuditoria] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [entradas, trilha] = await Promise.all([
        Promise.all(
          PERIODOS.map(async (periodo) => [periodo.id, await api.relatorios.faturamento(periodo.id)])
        ),
        api.relatorios.auditoria(40).catch(() => []),
      ]);
      setDados(Object.fromEntries(entradas));
      setAuditoria(Array.isArray(trilha) ? trilha : []);
    } catch (e) {
      notificar.erro('Financeiro indisponível', e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const dia = dados.dia;
  const semana = dados.semana;
  const mes = dados.mes;

  const maiorDia = useMemo(() => {
    const serie = semana?.serieDiaria ?? [];
    return Math.max(1, ...serie.map((ponto) => ponto.valor));
  }, [semana]);

  const acoes = (
    <div className="flex items-center gap-2">
      <AcaoTopo icone={RefreshCw} rotulo="Atualizar financeiro" variante="escura" girando={carregando} onClick={recarregar} />
      <a
        href="#/caixa"
        aria-label="Caixa do turno"
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg bg-rico-red px-3 text-rotulo font-semibold text-rico-light shadow-suave transition hover:bg-vinho-profundo"
      >
        <LockKeyhole size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Caixa do turno</span>
      </a>
    </div>
  );

  return (
    <AppShell titulo="Financeiro" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      <div className="space-y-5">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          <ResumoCard titulo="Faturamento do dia" valor={dia?.recebido.total} Icone={CalendarDays} detalhe={dia?.rotulo} />
          <ResumoCard titulo="Últimos 7 dias" valor={semana?.recebido.total} Icone={TrendingUp} detalhe={semana?.rotulo} />
          <ResumoCard
            titulo="Mês atual"
            valor={mes?.recebido.total}
            Icone={Landmark}
            detalhe={mes?.rotulo}
            className="col-span-2 md:col-span-1"
          />
        </section>

        <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-rico-wood/30 bg-white p-5 shadow-suave">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-carvao-claro">
                Evolução semanal
              </h2>
              <span className="text-xs font-bold text-carvao-suave">{semana && `${diaMes(semana.de)} a ${diaMes(semana.ate)}`}</span>
            </div>
            {/* Uma série só: sem legenda (o título nomeia). Valor curto sobre cada
                barra, dia embaixo; topo arredondado e ancorado na base. O texto
                fica na cor do texto, nunca na cor da barra. */}
            <figure className="mt-5">
              <div className="flex h-56 items-end gap-2 border-b border-carvao/20 sm:gap-3" aria-hidden="true">
                {(semana?.serieDiaria ?? []).map((ponto) => (
                  <div key={ponto.dia} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${diaMes(ponto.dia)}: ${moeda(ponto.valor)}`}>
                    <span className="whitespace-nowrap text-xs font-semibold text-carvao tabular-nums">
                      {ponto.valor > 0 ? moedaCurta(ponto.valor) : '—'}
                    </span>
                    <div
                      className="w-full max-w-12 rounded-t-[4px] bg-rico-red"
                      style={{ height: `${ponto.valor > 0 ? Math.max(2, (ponto.valor / maiorDia) * 100) : 0}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2 sm:gap-3" aria-hidden="true">
                {(semana?.serieDiaria ?? []).map((ponto) => (
                  <span key={ponto.dia} className="min-w-0 flex-1 text-center text-xs font-semibold text-carvao-suave tabular-nums">
                    {diaMes(ponto.dia)}
                  </span>
                ))}
              </div>
              {/* Versão em tabela para leitor de tela */}
              <figcaption className="sr-only">
                Faturamento por dia:{' '}
                {(semana?.serieDiaria ?? []).map((p) => `${diaMes(p.dia)} ${moeda(p.valor)}`).join('; ')}
              </figcaption>
            </figure>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl bg-carvao p-5 text-rico-light shadow-media">
              <h2 className="flex items-center gap-2 text-sm font-bold text-rico-light/70">
                <Receipt size={16} /> Hoje
              </h2>
              <p className="mt-2 font-display text-4xl text-rico-wood">
                {moeda(dia?.recebido.total)}
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <Linha rotulo="Pedidos pagos" valor={dia?.pedidosPagos.quantidade ?? 0} />
                <Linha rotulo="Ticket médio" valor={moeda(dia?.pedidosPagos.ticketMedio)} />
                <Linha rotulo="Comandas abertas" valor={dia?.comandasAbertasAgora ?? 0} />
                <Linha rotulo="Cancelamentos" valor={dia?.cancelados.quantidade ?? 0} />
              </dl>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {FORMAS.map(({ id, rotulo, Icone }) => {
                const forma = dia?.recebido.porForma?.[id];
                return (
                  <div key={id} className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10">
                    <p className="flex items-center gap-2 text-rotulo font-semibold text-carvao-suave">
                      <Icone size={15} className="text-rico-red" /> {rotulo}
                    </p>
                    <p className="mt-1 text-xl font-bold text-carvao">{moeda(forma?.valor)}</p>
                    <p className="text-xs font-semibold text-carvao-suave">
                      {plural(forma?.lancamentos ?? 0, 'lançamento', 'lançamentos')}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-rico-wood/25 bg-white/82 p-5 shadow-suave ring-1 ring-rico-wood/10">
              <h2 className="flex items-center gap-2 text-sm font-bold text-carvao-claro">
                <Trophy size={16} className="text-rico-red" /> Mais vendidos (hoje)
              </h2>
              {(dia?.topProdutos ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-carvao-suave">Sem vendas registradas hoje.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {dia.topProdutos.map((produto, i) => (
                    <li key={produto.nome} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rico-red/10 text-xs font-bold text-rico-red">
                          {i + 1}
                        </span>
                        <span data-nome-produto className="break-words font-semibold text-carvao">{produto.nome}</span>
                      </span>
                      <span className="shrink-0 text-right font-bold text-carvao-claro tabular-nums">
                        {produto.quantidade}x · {moeda(produto.valor)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {/* Vendas por quem lançou (garçom/gerente/online) */}
          <div className="rounded-xl border border-rico-wood/25 bg-white/82 p-5 shadow-suave ring-1 ring-rico-wood/10">
            <h2 className="flex items-center gap-2 text-sm font-bold text-carvao-claro">
              <Users size={16} className="text-rico-red" /> Vendas por atendente (hoje)
            </h2>
            {(dia?.porGarcom ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-carvao-suave">Sem vendas registradas hoje.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dia.porGarcom.map((g) => (
                  <li key={g.nome} className="flex items-center justify-between gap-3 rounded-lg bg-rico-wood/8 px-3 py-2 text-sm">
                    <span className="min-w-0 break-words font-bold text-carvao">{g.nome}</span>
                    <span className="shrink-0 text-right font-semibold text-carvao-claro tabular-nums">
                      {plural(g.pedidos, 'pedido', 'pedidos')} · {moeda(g.total)}
                      {g.taxaServico > 0 && (
                        <span className="ml-1 text-xs text-carvao-suave">
                          (+{moeda(g.taxaServico)} taxa)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Trilha de auditoria: quem fez o quê */}
          <div className="rounded-xl border border-rico-wood/25 bg-white/82 p-5 shadow-suave ring-1 ring-rico-wood/10">
            <h2 className="flex items-center gap-2 text-sm font-bold text-carvao-claro">
              <ScrollText size={16} className="text-rico-red" /> Auditoria
            </h2>
            {auditoria.length === 0 ? (
              <p className="mt-3 text-sm text-carvao-suave">Nenhuma ação registrada ainda.</p>
            ) : (
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {auditoria.map((r) => (
                  <li key={r.id} className="rounded-lg border border-rico-wood/20 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-carvao/8 px-2 py-0.5 text-xs font-extrabold text-carvao-claro">
                        {rotuloAcao(r.acao)}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-carvao-suave">
                        {dataHoraLoja(r.criadoEm, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-1 text-rotulo font-semibold text-carvao">{r.detalhe}</p>
                    <p className="text-xs font-semibold text-carvao-suave">{r.usuario}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

// "PAGAMENTO_MESA" -> "Pagamento mesa" (rótulo em sentence case, sem caixa alta)
function rotuloAcao(acao) {
  const t = String(acao ?? '').replaceAll('_', ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function ResumoCard({ titulo, valor, Icone, detalhe, className = '' }) {
  return (
    <article className={`min-w-0 rounded-2xl border border-rico-wood/30 bg-white p-4 shadow-suave md:p-5 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-rotulo font-semibold text-carvao-suave">{titulo}</p>
        <span className="hidden rounded-lg bg-erro-fundo p-2 text-rico-red sm:block">
          <Icone size={18} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 break-words font-display text-xl text-carvao tabular-nums sm:text-2xl md:mt-3 md:text-3xl">{moeda(valor)}</p>
      {/* O rótulo do período só aparece quando acrescenta algo ao título */}
      {detalhe && !titulo.toLowerCase().includes(detalhe.toLowerCase()) && (
        <p className="mt-1 text-rotulo font-medium text-carvao-suave">{detalhe}</p>
      )}
    </article>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-creme/10 pb-2 last:border-0 last:pb-0">
      <dt className="text-rico-light/75">{rotulo}</dt>
      <dd className="font-bold text-rico-light">{valor}</dd>
    </div>
  );
}
