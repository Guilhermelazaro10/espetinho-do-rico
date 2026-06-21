import { useCallback, useEffect, useState } from 'react';
import {
  Printer, RefreshCw, CheckCircle2, Clock, Loader2, AlertTriangle,
  Wifi, WifiOff, RotateCcw, FlaskConical,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
import { notificar } from '../ui/toast';

const ROTULO_TIPO = { cupom: 'Cupom', pre_conta: 'Pré-conta', gaveta: 'Gaveta', teste: 'Teste' };

const STATUS = {
  pendente: { rotulo: 'Na fila', classe: 'bg-amber-100 text-amber-700', Icone: Clock, girar: false },
  processando: { rotulo: 'Imprimindo', classe: 'bg-sky-100 text-sky-700', Icone: Loader2, girar: true },
  impresso: { rotulo: 'Impresso', classe: 'bg-emerald-100 text-emerald-700', Icone: CheckCircle2, girar: false },
  erro: { rotulo: 'Erro', classe: 'bg-rico-red/10 text-rico-red', Icone: AlertTriangle, girar: false },
};

function horaCurta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function desdeContato(ts) {
  if (!ts) return 'sem contato ainda';
  const seg = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seg < 60) return `há ${seg}s`;
  return `há ${Math.round(seg / 60)} min`;
}

function Cartao({ rotulo, valor, classe, Icone }) {
  return (
    <div className="rounded-xl bg-white/80 p-4 shadow-suave ring-1 ring-rico-wood/20">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-carvao-suave">{rotulo}</span>
        <span className={`rounded-lg p-1.5 ${classe}`}><Icone size={16} /></span>
      </div>
      <p className="mt-1 font-display text-3xl text-rico-dark">{valor ?? 0}</p>
    </div>
  );
}

export default function Impressora({ sessao, aoSair }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [testando, setTestando] = useState(false);

  const recarregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCarregando(true);
    try {
      setDados(await api.impressora.resumo());
    } catch (e) {
      if (!silencioso) notificar.erro('Painel indisponível', e.message);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    const t = setInterval(() => recarregar({ silencioso: true }), 4000);
    return () => clearInterval(t);
  }, [recarregar]);

  async function imprimirTeste() {
    setTestando(true);
    try {
      await api.impressora.teste();
      notificar.sucesso('Teste enviado', 'O cupom deve sair em instantes na impressora.');
      recarregar({ silencioso: true });
    } catch (e) {
      notificar.erro('Não foi possível testar', e.message);
    } finally {
      setTestando(false);
    }
  }

  async function reimprimir(id) {
    try {
      await api.impressora.reimprimir(id);
      notificar.sucesso('Reenviado', `Cupom #${id} voltou para a fila.`);
      recarregar({ silencioso: true });
    } catch (e) {
      notificar.erro('Não foi possível reimprimir', e.message);
    }
  }

  const agente = dados?.agente;
  const online = agente?.online;
  const fila = dados?.fila ?? {};
  const recentes = dados?.recentes ?? [];

  const acoes = (
    <button
      onClick={() => recarregar()}
      className="flex items-center gap-2 rounded-lg border border-rico-wood/30 bg-white/70 px-3 py-2 text-sm font-bold text-rico-dark transition hover:bg-white"
    >
      <RefreshCw size={15} className={carregando ? 'animate-spin' : ''} /> Atualizar
    </button>
  );

  return (
    <AppShell titulo="Impressão" sessao={sessao} aoSair={aoSair} acoes={acoes}>
      <div className="mx-auto grid max-w-5xl gap-5">
        {/* Status do agente */}
        <section
          className={`rounded-xl p-5 shadow-media ring-1 ${
            online ? 'bg-emerald-50 ring-emerald-200' : 'bg-rico-red/5 ring-rico-red/25'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-suave ${
                  online ? 'bg-emerald-500' : 'bg-rico-red'
                }`}
              >
                {online ? <Wifi size={24} /> : <WifiOff size={24} />}
              </span>
              <div>
                <p className="font-display text-xl text-rico-dark">
                  {online ? 'Agente online' : 'Agente offline'}
                </p>
                <p className="text-sm font-semibold text-carvao-suave">
                  Último contato: {desdeContato(agente?.ultimoContato)}
                </p>
              </div>
            </div>
            <button
              onClick={imprimirTeste}
              disabled={testando}
              className="flex items-center gap-2 rounded-xl bg-rico-red px-4 py-3 text-sm font-extrabold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
            >
              {testando ? <Loader2 size={18} className="animate-spin" /> : <FlaskConical size={18} />}
              Imprimir teste
            </button>
          </div>

          {!online && (
            <p className="mt-4 rounded-lg bg-white/70 px-4 py-3 text-sm font-semibold text-carvao">
              O agente no PC do caixa parece desligado. Abra o atalho da impressão (ou rode
              <span className="font-mono"> instalar-inicio-automatico.bat</span>) e confira se o PC e a
              impressora estão ligados na rede. Os cupons ficam guardados na fila até ele voltar.
            </p>
          )}
        </section>

        {/* Contadores da fila */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cartao rotulo="Na fila" valor={fila.pendente} classe={STATUS.pendente.classe} Icone={Clock} />
          <Cartao rotulo="Imprimindo" valor={fila.processando} classe={STATUS.processando.classe} Icone={Printer} />
          <Cartao rotulo="Impressos" valor={fila.impresso} classe={STATUS.impresso.classe} Icone={CheckCircle2} />
          <Cartao rotulo="Erros" valor={fila.erro} classe={STATUS.erro.classe} Icone={AlertTriangle} />
        </section>

        {/* Últimos cupons */}
        <section className="rounded-xl bg-white/80 shadow-media ring-1 ring-rico-wood/25">
          <div className="flex items-center gap-2 border-b border-rico-wood/25 px-5 py-4">
            <Printer size={18} className="text-rico-red" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-rico-dark">Últimos cupons</h2>
          </div>

          {recentes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm font-semibold text-carvao-suave">
              {carregando ? 'Carregando…' : 'Nenhum cupom impresso ainda.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="bg-rico-wood/12 text-xs font-bold uppercase tracking-wider text-rico-dark">
                  <tr>
                    <th className="px-5 py-3">#</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Hora</th>
                    <th className="px-5 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rico-wood/18">
                  {recentes.map((job) => {
                    const s = STATUS[job.status] ?? STATUS.pendente;
                    return (
                      <tr key={job.id} className="odd:bg-white/60 even:bg-rico-light">
                        <td className="px-5 py-3 font-bold text-carvao">#{job.id}</td>
                        <td className="px-5 py-3 text-sm font-semibold text-carvao-claro">
                          {ROTULO_TIPO[job.tipo] ?? job.tipo}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${s.classe}`}>
                            <s.Icone size={13} className={s.girar ? 'animate-spin' : ''} />
                            {s.rotulo}
                          </span>
                          {job.status === 'erro' && job.erro && (
                            <span className="ml-2 text-xs font-semibold text-rico-red/80">{job.erro}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm font-semibold text-carvao-suave">{horaCurta(job.criadoEm)}</td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end">
                            {(job.status === 'impresso' || job.status === 'erro') && (
                              <button
                                onClick={() => reimprimir(job.id)}
                                className="flex items-center gap-1.5 rounded-lg bg-carvao px-3 py-2 text-xs font-bold text-rico-light transition hover:bg-carvao-claro"
                              >
                                <RotateCcw size={13} /> Reimprimir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
