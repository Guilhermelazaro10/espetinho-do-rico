import { useCallback, useEffect, useState } from 'react';
import {
  Wallet, Banknote, QrCode, CreditCard, ArrowDownCircle, ArrowUpCircle,
  LockKeyhole, Unlock, RefreshCw, Loader2, Scale,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, moeda, paraCentavos } from '../lib/api';
import { notificar } from '../ui/toast';

const FORMAS = [
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'cartao', rotulo: 'Cartao', Icone: CreditCard },
];

export default function CaixaTurno({ sessao, aoSair }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const [fundo, setFundo] = useState('100,00');
  const [mov, setMov] = useState({ tipo: 'sangria', valor: '', motivo: '' });
  const [contado, setContado] = useState('');
  const [obs, setObs] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [ultimoFechamento, setUltimoFechamento] = useState(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await api.caixa.atual());
    } catch (e) {
      notificar.erro('Caixa indisponivel', e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const caixa = dados?.caixa ?? null;
  const resumo = dados?.resumo ?? null;

  async function abrir() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await api.caixa.abrir(paraCentavos(fundo));
      notificar.sucesso('Caixa aberto', `Fundo de troco ${moeda(paraCentavos(fundo))}`);
      setUltimoFechamento(null);
      await recarregar();
    } catch (e) {
      notificar.erro('Nao foi possivel abrir', e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function registrarMovimento() {
    if (ocupado) return;
    const valor = paraCentavos(mov.valor);
    if (valor <= 0 || mov.motivo.trim().length < 3) {
      notificar.erro('Dados incompletos', 'Informe valor e motivo (min. 3 letras)');
      return;
    }
    setOcupado(true);
    try {
      await api.caixa.movimento({ tipo: mov.tipo, valor, motivo: mov.motivo.trim() });
      notificar.sucesso(mov.tipo === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado', moeda(valor));
      setMov({ tipo: mov.tipo, valor: '', motivo: '' });
      await recarregar();
    } catch (e) {
      notificar.erro('Movimento recusado', e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function fechar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const resultado = await api.caixa.fechar({
        valorContado: paraCentavos(contado),
        observacao: obs.trim() || undefined,
      });
      const dif = resultado.resumo.diferenca;
      setUltimoFechamento(resultado.resumo);
      if (dif === 0) notificar.sucesso('Caixa fechado — bateu certinho!', 'Sem diferenca');
      else if (dif > 0) notificar.brasa('Caixa fechado — sobra', `+${moeda(dif)} na gaveta`);
      else notificar.erro('Caixa fechado — falta', `${moeda(dif)} faltando`);
      setContado('');
      setObs('');
      await recarregar();
    } catch (e) {
      notificar.erro('Nao foi possivel fechar', e.message);
    } finally {
      setOcupado(false);
    }
  }

  const acoes = (
    <button
      onClick={recarregar}
      className="rounded-lg bg-carvao p-2 text-rico-light transition hover:bg-carvao-claro"
      aria-label="Atualizar caixa"
      title="Atualizar"
    >
      <RefreshCw size={17} className={carregando ? 'animate-spin' : ''} />
    </button>
  );

  return (
    <AppShell titulo="Caixa" acoes={acoes} sessao={sessao} aoSair={aoSair}>
      {!dados ? (
        <p className="py-16 text-center text-sm text-carvao-suave">Carregando caixa...</p>
      ) : !caixa ? (
        <CaixaFechado
          fundo={fundo}
          setFundo={setFundo}
          abrir={abrir}
          ocupado={ocupado}
          ultimoFechamento={ultimoFechamento}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Resumo do turno */}
          <section className="space-y-4">
            <div className="rounded-xl bg-carvao p-6 text-rico-light shadow-media">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-rico-light/60">
                  <Unlock size={14} /> Caixa aberto
                </p>
                <span className="text-xs font-semibold text-rico-light/50">
                  desde {new Date(caixa.abertoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-rico-light/45">por {caixa.abertoPor}</p>

              <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-rico-wood">
                Esperado em dinheiro na gaveta
              </p>
              <p className="font-display text-5xl text-rico-wood">{moeda(resumo.esperadoDinheiro)}</p>
              <p className="mt-1 text-xs text-rico-light/45">
                Fundo {moeda(caixa.fundoAbertura)} + dinheiro {moeda(resumo.recebidoDinheiro)} + suprimentos{' '}
                {moeda(resumo.suprimentos)} − sangrias {moeda(resumo.sangrias)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {FORMAS.map(({ id, rotulo, Icone }) => {
                const forma = resumo.porForma?.[id];
                return (
                  <div key={id} className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-carvao-suave">
                      <Icone size={15} className="text-rico-red" /> {rotulo}
                    </p>
                    <p className="mt-1 text-xl font-bold text-carvao">{moeda(forma?.valor)}</p>
                    <p className="text-xs font-semibold text-carvao-suave">{forma?.lancamentos ?? 0} lancamento(s)</p>
                  </div>
                );
              })}
            </div>

            {/* Movimentos do turno */}
            {caixa.movimentos?.length > 0 && (
              <div className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-carvao-suave">Movimentos</h3>
                <ul className="mt-2 divide-y divide-rico-wood/15">
                  {caixa.movimentos.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex items-center gap-2 font-semibold text-carvao">
                        {m.tipo === 'sangria' ? (
                          <ArrowDownCircle size={15} className="text-rico-red" />
                        ) : (
                          <ArrowUpCircle size={15} className="text-emerald-600" />
                        )}
                        {m.motivo}
                      </span>
                      <strong className={m.tipo === 'sangria' ? 'text-rico-red' : 'text-emerald-700'}>
                        {m.tipo === 'sangria' ? '−' : '+'}{moeda(m.valor)}
                      </strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Ações: sangria/suprimento e fechamento */}
          <aside className="space-y-4">
            <div className="rounded-xl bg-rico-dark p-5 text-rico-light shadow-media">
              <h2 className="text-sm font-bold uppercase tracking-wider text-rico-light/70">Sangria / Suprimento</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {['sangria', 'suprimento'].map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setMov((m) => ({ ...m, tipo }))}
                    className={`rounded-lg py-2 text-sm font-bold capitalize transition ${
                      mov.tipo === tipo ? 'bg-rico-red text-rico-light shadow-brasa' : 'bg-rico-light/10 text-rico-light/60'
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
              <input
                value={mov.valor}
                onChange={(e) => setMov((m) => ({ ...m, valor: e.target.value }))}
                placeholder="Valor (R$)"
                inputMode="decimal"
                className="mt-3 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-bold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
              />
              <input
                value={mov.motivo}
                onChange={(e) => setMov((m) => ({ ...m, motivo: e.target.value }))}
                placeholder="Motivo"
                className="mt-2 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
              />
              <button
                onClick={registrarMovimento}
                disabled={ocupado}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rico-light/12 font-bold text-rico-light transition hover:bg-rico-light/20 disabled:opacity-40"
              >
                Registrar
              </button>
            </div>

            <div className="rounded-xl border-2 border-rico-red/30 bg-white/85 p-5 shadow-media">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-rico-red">
                <Scale size={16} /> Fechar caixa
              </h2>
              <p className="mt-1 text-xs font-semibold text-carvao-suave">
                Conte a gaveta e informe o total (conferencia cega).
              </p>
              <input
                value={contado}
                onChange={(e) => setContado(e.target.value)}
                placeholder="Valor contado (R$)"
                inputMode="decimal"
                className="mt-3 w-full rounded-lg bg-rico-light px-3 py-3 text-lg font-bold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
              />
              <input
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Observacao (opcional)"
                className="mt-2 w-full rounded-lg bg-rico-light px-3 py-2 text-sm font-semibold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
              />
              <button
                onClick={fechar}
                disabled={ocupado || contado.trim() === ''}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rico-red font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ocupado ? <Loader2 size={18} className="animate-spin" /> : <LockKeyhole size={17} />} Fechar caixa
              </button>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function CaixaFechado({ fundo, setFundo, abrir, ocupado, ultimoFechamento }) {
  return (
    <div className="mx-auto max-w-md space-y-5">
      {ultimoFechamento && <ResultadoFechamento resumo={ultimoFechamento} />}

      <div className="rounded-xl bg-carvao p-6 text-rico-light shadow-media">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rico-red shadow-brasa">
            <Wallet size={26} />
          </span>
          <h1 className="mt-4 font-display text-2xl">Caixa fechado</h1>
          <p className="mt-1 text-sm text-rico-light/60">Abra o caixa com o fundo de troco para comecar o turno.</p>
        </div>

        <label className="mt-6 block text-[11px] font-bold uppercase tracking-wider text-rico-wood">
          Fundo de troco
        </label>
        <input
          value={fundo}
          onChange={(e) => setFundo(e.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-xl bg-rico-light px-4 py-3 text-lg font-bold text-carvao outline-none ring-1 ring-rico-wood/30 focus:ring-rico-red"
        />
        <button
          onClick={abrir}
          disabled={ocupado}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-rico-red font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40"
        >
          {ocupado ? <Loader2 size={20} className="animate-spin" /> : <Unlock size={19} />} Abrir caixa
        </button>
      </div>
    </div>
  );
}

function ResultadoFechamento({ resumo }) {
  const dif = resumo.diferenca;
  const cor = dif === 0 ? 'text-emerald-700' : dif > 0 ? 'text-rico-wood' : 'text-rico-red';
  return (
    <div className="rounded-xl border border-rico-wood/25 bg-white/85 p-5 shadow-media">
      <h2 className="text-sm font-bold uppercase tracking-wider text-carvao-claro">Ultimo fechamento</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-carvao-suave">Esperado</dt><dd className="font-bold text-carvao">{moeda(resumo.esperadoDinheiro)}</dd></div>
        <div className="flex justify-between"><dt className="text-carvao-suave">Contado</dt><dd className="font-bold text-carvao">{moeda(resumo.valorContado)}</dd></div>
        <div className="flex justify-between border-t border-rico-wood/20 pt-2">
          <dt className="font-bold uppercase tracking-wide text-carvao">Diferenca</dt>
          <dd className={`font-display text-2xl ${cor}`}>
            {dif > 0 ? '+' : ''}{moeda(dif)}
          </dd>
        </div>
      </dl>
      <p className={`mt-2 text-center text-sm font-bold ${cor}`}>
        {dif === 0 ? 'Bateu certinho!' : dif > 0 ? 'Sobrou na gaveta' : 'Faltou na gaveta'}
      </p>
    </div>
  );
}
