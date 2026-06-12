import { useCallback, useEffect, useState } from 'react';
import { QrCode, Banknote, CreditCard, Receipt, Ban, Coins, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import { api, moeda } from '../lib/api';
import { notificar } from '../ui/toast';

const ICONES_FORMA = { pix: QrCode, dinheiro: Banknote, cartao: CreditCard };
const ROTULOS_FORMA = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' };

/*
 * Fechamento de caixa do dia — conferência da gaveta.
 * Fonte: tabela de pagamentos (valores líquidos, troco já descontado).
 */
export default function Fechamento({ sessao, aoSair }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [relatorio, setRelatorio] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const buscar = useCallback(async (dia) => {
    setCarregando(true);
    try {
      setRelatorio(await api.relatorios.fechamento(dia));
    } catch (e) {
      notificar.erro('Não foi possível carregar o fechamento', e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar(data);
  }, [data, buscar]);

  const acoes = (
    <div className="flex items-center gap-3">
      <label className="text-xs font-bold uppercase tracking-wider text-carvao-suave">
        Dia
      </label>
      <input
        type="date"
        value={data}
        max={hoje}
        onChange={(e) => setData(e.target.value)}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-carvao shadow-suave ring-1 ring-carvao/10 outline-none focus:ring-rico-red"
      />
      <button
        onClick={() => buscar(data)}
        className="flex items-center gap-1.5 rounded-lg bg-carvao px-3 py-1.5 text-xs font-bold text-rico-light transition hover:bg-carvao-claro"
      >
        <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} /> Atualizar
      </button>
    </div>
  );

  return (
    <Layout acoes={acoes} sessao={sessao} aoSair={aoSair}>
      {!relatorio ? (
        <p className="py-16 text-center text-sm text-carvao-suave">Carregando fechamento…</p>
      ) : (
        <div className="space-y-5">
          {/* Recebido na gaveta */}
          <section className="rounded-xl bg-carvao p-6 text-rico-light shadow-media">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-rico-light/60">
              Recebido no dia · {relatorio.data}
            </p>
            <p className="mt-1 font-display text-5xl text-brasa-clara">
              {moeda(relatorio.recebido.total)}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {['dinheiro', 'pix', 'cartao'].map((forma) => {
                const Icone = ICONES_FORMA[forma];
                const dados = relatorio.recebido.porForma[forma];
                return (
                  <div key={forma} className="rounded-xl bg-rico-light/8 p-4 ring-1 ring-rico-light/10">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rico-light/60">
                      <Icone size={14} /> {ROTULOS_FORMA[forma]}
                    </p>
                    <p className="mt-1 text-xl font-bold">{moeda(dados?.valor ?? 0)}</p>
                    <p className="text-[11px] text-rico-light/40">
                      {dados?.lancamentos ?? 0} lançamento(s)
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid gap-5 md:grid-cols-3">
            <Cartao
              icone={Receipt}
              titulo="Pedidos pagos"
              destaque={String(relatorio.pedidosPagos.quantidade)}
              linhas={[
                ['Produtos', moeda(relatorio.pedidosPagos.produtos)],
                ['Taxa de serviço', moeda(relatorio.pedidosPagos.taxaServico)],
                ['Ticket médio', moeda(relatorio.pedidosPagos.ticketMedio)],
              ]}
            />
            <Cartao
              icone={Ban}
              titulo="Cancelamentos"
              destaque={String(relatorio.cancelados.quantidade)}
              linhas={[['Valor não faturado', moeda(relatorio.cancelados.valor)]]}
            />
            <Cartao
              icone={Coins}
              titulo="Situação do salão"
              destaque={String(relatorio.comandasAbertasAgora)}
              linhas={[['Comandas ainda abertas', 'agora']]}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

function Cartao({ icone: Icone, titulo, destaque, linhas }) {
  return (
    <section className="rounded-xl bg-white/60 p-5 shadow-suave ring-1 ring-carvao/5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-carvao-claro">
        <Icone size={16} className="text-rico-red" /> {titulo}
      </h2>
      <p className="mt-2 font-display text-4xl text-carvao">{destaque}</p>
      <dl className="mt-3 space-y-1">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between text-[13px] text-carvao-suave">
            <dt>{rotulo}</dt>
            <dd className="font-semibold text-carvao-claro">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
