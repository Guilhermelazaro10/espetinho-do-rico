import { useCallback, useEffect, useState } from 'react';
import {
  Printer, RefreshCw, CheckCircle2, Clock, AlertTriangle,
  Wifi, WifiOff, RotateCcw, FlaskConical,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
import { horaLoja } from '../lib/datas';
import { notificar } from '../ui/toast';
import AcaoTopo from '../ui/AcaoTopo';
import Botao from '../ui/Botao';
import Selo from '../ui/Selo';

// Mapa fixo: o tipo cru da API ("fechamento", "pre_conta") nunca aparece na tela.
const ROTULO_TIPO = {
  cupom: 'Cupom',
  pre_conta: 'Pré-conta',
  fechamento: 'Fechamento',
  gaveta: 'Gaveta',
  teste: 'Teste',
};

// Status com cor semântica (Selo): o tom vem dos tokens, nunca de sky-*/amber-* soltos
const STATUS = {
  pendente: { rotulo: 'Na fila', tom: 'atencao', classe: 'bg-atencao-fundo text-atencao', Icone: Clock },
  processando: { rotulo: 'Imprimindo', tom: 'neutro', classe: 'bg-creme-escuro text-carvao', Icone: Printer },
  impresso: { rotulo: 'Impresso', tom: 'ok', classe: 'bg-ok-fundo text-ok', Icone: CheckCircle2 },
  erro: { rotulo: 'Erro', tom: 'erro', classe: 'bg-erro-fundo text-erro', Icone: AlertTriangle },
};

function horaCurta(iso) {
  return horaLoja(iso);
}

function desdeContato(ts) {
  if (!ts) return 'sem contato ainda';
  const seg = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seg < 60) return `há ${seg}s`;
  return `há ${Math.round(seg / 60)} min`;
}

function Cartao({ rotulo, valor, classe, Icone }) {
  return (
    <div className="rounded-2xl border border-rico-wood/30 bg-white p-4 shadow-suave">
      <div className="flex items-center justify-between">
        <span className="text-rotulo font-semibold text-carvao-suave">{rotulo}</span>
        <span className={`rounded-lg p-1.5 ${classe}`}><Icone size={16} aria-hidden="true" /></span>
      </div>
      <p className="mt-1 font-display text-3xl text-carvao tabular-nums">{valor ?? 0}</p>
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

  const acoes = <AcaoTopo icone={RefreshCw} rotulo="Atualizar" girando={carregando} onClick={() => recarregar()} />;

  return (
    <AppShell titulo="Impressão" sessao={sessao} aoSair={aoSair} acoes={acoes}>
      <div className="mx-auto grid max-w-5xl gap-5">
        {/* Status do agente */}
        <section
          className={`rounded-xl p-5 shadow-media ring-1 ${
            online ? 'bg-ok-fundo ring-ok-borda' : 'bg-erro-fundo ring-rico-red/25'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-suave ${
                  online ? 'bg-ok' : 'bg-rico-red'
                }`}
              >
                {online ? <Wifi size={24} /> : <WifiOff size={24} />}
              </span>
              <div>
                <p className="font-display text-xl text-carvao">
                  {online ? 'Agente online' : 'Agente offline'}
                </p>
                <p className="text-sm font-semibold text-carvao-suave">
                  Último contato: {desdeContato(agente?.ultimoContato)}
                </p>
              </div>
            </div>
            <Botao icone={FlaskConical} carregando={testando} onClick={imprimirTeste}>
              Imprimir teste
            </Botao>
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
        <section className="rounded-2xl border border-rico-wood/30 bg-white shadow-suave">
          <div className="flex items-center gap-2 border-b border-rico-wood/25 px-5 py-4">
            <Printer size={18} className="text-rico-red" />
            <h2 className="text-sm font-bold text-carvao">Últimos cupons</h2>
          </div>

          {recentes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm font-semibold text-carvao-suave">
              {carregando ? 'Carregando…' : 'Nenhum cupom impresso ainda.'}
            </p>
          ) : (
            <ul className="divide-y divide-rico-wood/18">
              {recentes.map((job) => {
                const s = STATUS[job.status] ?? STATUS.pendente;
                return (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="font-bold text-carvao tabular-nums">#{job.id}</span>
                      <span className="text-sm font-semibold text-carvao-claro">{ROTULO_TIPO[job.tipo] ?? 'Cupom'}</span>
                      <span className="text-xs font-semibold text-carvao-suave">{horaCurta(job.criadoEm)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Selo tom={s.tom} icone={s.Icone}>{s.rotulo}</Selo>
                      {/* No erro, Reimprimir fica ao lado do selo e em destaque */}
                      {(job.status === 'impresso' || job.status === 'erro') && (
                        <Botao
                          variante={job.status === 'erro' ? 'primario' : 'secundario'}
                          icone={RotateCcw}
                          onClick={() => reimprimir(job.id)}
                          aria-label={`Reimprimir ${(ROTULO_TIPO[job.tipo] ?? 'cupom').toLowerCase()} #${job.id}`}
                        >
                          Reimprimir
                        </Botao>
                      )}
                    </div>
                    {job.status === 'erro' && job.erro && (
                      <p className="w-full rounded-lg bg-erro-fundo px-3 py-2 text-rotulo font-semibold text-erro">{job.erro}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
