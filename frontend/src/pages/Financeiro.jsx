import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote, CalendarDays, CreditCard, Landmark, LockKeyhole, QrCode,
  Receipt, RefreshCw, TrendingUp, Trophy,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, moeda } from '../lib/api';
import { notificar } from '../ui/toast';

const PERIODOS = [
  { id: 'dia', rotulo: 'Hoje' },
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mes' },
];

const FORMAS = [
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'cartao', rotulo: 'Cartao', Icone: CreditCard },
];

export default function Financeiro({ sessao, aoSair }) {
  const [dados, setDados] = useState({});
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const entradas = await Promise.all(
        PERIODOS.map(async (periodo) => [periodo.id, await api.relatorios.faturamento(periodo.id)])
      );
      setDados(Object.fromEntries(entradas));
    } catch (e) {
      notificar.erro('Financeiro indisponivel', e.message);
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
      <button
        onClick={recarregar}
        className="rounded-lg bg-carvao p-2 text-rico-light transition hover:bg-carvao-claro"
        aria-label="Atualizar financeiro"
        title="Atualizar"
      >
        <RefreshCw size={17} className={carregando ? 'animate-spin' : ''} />
      </button>
      <a
        href="#/caixa"
        className="flex items-center gap-2 rounded-lg bg-rico-red px-3 py-2 text-xs font-bold text-rico-light shadow-brasa transition hover:bg-vinho-profundo"
      >
        <LockKeyhole size={14} /> Caixa do turno
      </a>
    </div>
  );

  return (
    <AppShell titulo="Financeiro" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      <div className="space-y-5">
        <section className="grid gap-4 md:grid-cols-3">
          <ResumoCard titulo="Faturamento do dia" valor={dia?.recebido.total} Icone={CalendarDays} detalhe={dia?.rotulo} />
          <ResumoCard titulo="Ultimos 7 dias" valor={semana?.recebido.total} Icone={TrendingUp} detalhe={semana?.rotulo} />
          <ResumoCard titulo="Mes atual" valor={mes?.recebido.total} Icone={Landmark} detalhe={mes?.rotulo} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-rico-wood/25 bg-white/82 p-5 shadow-media ring-1 ring-rico-wood/10">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-carvao-claro">
                Evolucao semanal
              </h2>
              <span className="text-xs font-bold text-carvao-suave">{semana?.de} ate {semana?.ate}</span>
            </div>
            <div
              className="mt-6 flex h-64 items-end gap-3"
              role="img"
              aria-label={`Faturamento por dia: ${(semana?.serieDiaria ?? [])
                .map((p) => `${new Date(`${p.dia}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${moeda(p.valor)}`)
                .join('; ')}`}
            >
              {(semana?.serieDiaria ?? []).map((ponto) => (
                <div key={ponto.dia} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-52 w-full items-end rounded-lg bg-rico-wood/12 p-1">
                    <div
                      className="w-full rounded-md bg-brasa-gradiente shadow-brasa"
                      style={{ height: `${Math.max(4, (ponto.valor / maiorDia) * 100)}%` }}
                      title={moeda(ponto.valor)}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-carvao-suave">
                    {new Date(`${ponto.dia}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl bg-carvao p-5 text-rico-light shadow-media">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rico-light/70">
                <Receipt size={16} /> Hoje
              </h2>
              <p className="mt-2 font-display text-4xl text-rico-wood">
                {moeda(dia?.recebido.total)}
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                <Linha rotulo="Pedidos pagos" valor={dia?.pedidosPagos.quantidade ?? 0} />
                <Linha rotulo="Ticket medio" valor={moeda(dia?.pedidosPagos.ticketMedio)} />
                <Linha rotulo="Comandas abertas" valor={dia?.comandasAbertasAgora ?? 0} />
                <Linha rotulo="Cancelamentos" valor={dia?.cancelados.quantidade ?? 0} />
              </dl>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {FORMAS.map(({ id, rotulo, Icone }) => {
                const forma = dia?.recebido.porForma?.[id];
                return (
                  <div key={id} className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-carvao-suave">
                      <Icone size={15} className="text-rico-red" /> {rotulo}
                    </p>
                    <p className="mt-1 text-xl font-bold text-carvao">{moeda(forma?.valor)}</p>
                    <p className="text-xs font-semibold text-carvao-suave">
                      {forma?.lancamentos ?? 0} lancamento(s)
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-rico-wood/25 bg-white/82 p-5 shadow-suave ring-1 ring-rico-wood/10">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-carvao-claro">
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
                        <span className="truncate font-semibold text-carvao">{produto.nome}</span>
                      </span>
                      <span className="shrink-0 font-bold text-carvao-claro">
                        {produto.quantidade}x · {moeda(produto.valor)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function ResumoCard({ titulo, valor, Icone, detalhe }) {
  return (
    <article className="rounded-xl border border-rico-wood/25 bg-white/82 p-5 shadow-suave ring-1 ring-rico-wood/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-carvao-suave">{titulo}</p>
        <span className="rounded-lg bg-rico-red/10 p-2 text-rico-red">
          <Icone size={18} />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl text-carvao">{moeda(valor)}</p>
      <p className="mt-1 text-sm font-semibold text-carvao-suave">{detalhe ?? 'Carregando'}</p>
    </article>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-creme/10 pb-2 last:border-0 last:pb-0">
      <dt className="text-rico-light/55">{rotulo}</dt>
      <dd className="font-bold text-rico-light">{valor}</dd>
    </div>
  );
}
