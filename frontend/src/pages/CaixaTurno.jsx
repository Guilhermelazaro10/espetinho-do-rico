import { useCallback, useEffect, useState } from 'react';
import {
  Wallet, Banknote, QrCode, CreditCard, ArrowDownCircle, ArrowUpCircle,
  LockKeyhole, Unlock, RefreshCw, Loader2, Scale,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, moeda, paraCentavos } from '../lib/api';
import { dataHoraLoja } from '../lib/datas';
import { notificar } from '../ui/toast';
import { plural } from '../lib/plural';
import AcaoTopo from '../ui/AcaoTopo';
import Campo from '../ui/Campo';

const FORMAS = [
  { id: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
  { id: 'pix', rotulo: 'Pix', Icone: QrCode },
  { id: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
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
      notificar.erro('Caixa indisponível', e.message);
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
      notificar.erro('Não foi possível abrir', e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function registrarMovimento() {
    if (ocupado) return;
    const valor = paraCentavos(mov.valor);
    if (valor <= 0 || mov.motivo.trim().length < 3) {
      notificar.erro('Dados incompletos', 'Informe valor e motivo (mínimo 3 letras)');
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
      if (dif === 0) notificar.sucesso('Caixa fechado — bateu certinho!', 'Sem diferença');
      else if (dif > 0) notificar.brasa('Caixa fechado — sobra', `+${moeda(dif)} na gaveta`);
      else notificar.erro('Caixa fechado — falta', `${moeda(dif)} faltando`);
      setContado('');
      setObs('');
      await recarregar();
    } catch (e) {
      notificar.erro('Não foi possível fechar', e.message);
    } finally {
      setOcupado(false);
    }
  }

  const acoes = <AcaoTopo icone={RefreshCw} rotulo="Atualizar caixa" variante="escura" girando={carregando} onClick={recarregar} />;

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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Resumo do turno */}
          <section className="space-y-4">
            <div className="rounded-xl bg-carvao p-6 text-rico-light shadow-media">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-rotulo font-semibold text-rico-light/80">
                  <Unlock size={14} /> Caixa aberto
                </p>
                <span className="text-xs font-semibold text-rico-light/70">
                  desde {dataHoraLoja(caixa.abertoEm, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-rico-light/75">
                {/* O servidor grava "Nome (GERENTE)": só a exibição vira sentence case */}
                por {String(caixa.abertoPor ?? '').replace('(GERENTE)', '(Gerente)').replace('(GARCOM)', '(Garçom)')}
              </p>

              <p className="mt-4 text-rotulo font-semibold text-rico-wood">
                Esperado em dinheiro na gaveta
              </p>
              <p className="break-words font-display text-4xl text-rico-wood tabular-nums sm:text-5xl">{moeda(resumo.esperadoDinheiro)}</p>
              <p className="mt-1 text-xs text-rico-light/75 tabular-nums">
                Fundo {moeda(caixa.fundoAbertura)} + dinheiro {moeda(resumo.recebidoDinheiro)} + suprimentos{' '}
                {moeda(resumo.suprimentos)} − sangrias {moeda(resumo.sangrias)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {FORMAS.map(({ id, rotulo, Icone }) => {
                const forma = resumo.porForma?.[id];
                return (
                  <div key={id} className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10">
                    <p className="flex items-center gap-2 text-rotulo font-semibold text-carvao-suave">
                      <Icone size={15} className="text-rico-red" /> {rotulo}
                    </p>
                    <p className="mt-1 text-xl font-bold text-carvao tabular-nums">{moeda(forma?.valor)}</p>
                    <p className="text-xs font-semibold text-carvao-suave">{plural(forma?.lancamentos ?? 0, 'lançamento', 'lançamentos')}</p>
                  </div>
                );
              })}
            </div>

            {/* Movimentos do turno */}
            {caixa.movimentos?.length > 0 && (
              <div className="rounded-xl border border-rico-wood/25 bg-white/82 p-4 shadow-suave ring-1 ring-rico-wood/10">
                <h3 className="text-rotulo font-semibold text-carvao-suave">Movimentos</h3>
                <ul className="mt-2 divide-y divide-rico-wood/15">
                  {caixa.movimentos.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="flex items-center gap-2 font-semibold text-carvao">
                        {m.tipo === 'sangria' ? (
                          <ArrowDownCircle size={15} className="text-rico-red" />
                        ) : (
                          <ArrowUpCircle size={15} className="text-ok" />
                        )}
                        {m.motivo}
                      </span>
                      <strong className={`shrink-0 tabular-nums ${m.tipo === 'sangria' ? 'text-rico-red' : 'text-ok'}`}>
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
              <h2 className="text-sm font-bold text-rico-light/80">Sangria / Suprimento</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {['sangria', 'suprimento'].map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setMov((m) => ({ ...m, tipo }))}
                    aria-pressed={mov.tipo === tipo}
                    className={`min-h-11 rounded-lg text-sm font-semibold transition-colors ${
                      mov.tipo === tipo ? 'bg-rico-red text-white' : 'bg-rico-light/10 text-rico-light/80 hover:bg-rico-light/16'
                    }`}
                  >
                    {tipo === 'sangria' ? 'Sangria (−)' : 'Suprimento (+)'}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-3">
                <Campo
                  tom="escuro"
                  rotulo="Valor (R$)"
                  placeholder="ex.: 50,00"
                  inputMode="decimal"
                  value={mov.valor}
                  onChange={(e) => setMov((m) => ({ ...m, valor: e.target.value }))}
                />
                <Campo
                  tom="escuro"
                  rotulo="Motivo"
                  placeholder="ex.: troco para o banco"
                  value={mov.motivo}
                  onChange={(e) => setMov((m) => ({ ...m, motivo: e.target.value }))}
                />
              </div>
              <button
                type="button"
                onClick={registrarMovimento}
                disabled={ocupado}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-creme font-semibold text-carvao transition-colors hover:bg-white disabled:bg-rico-light/12 disabled:text-rico-light/75"
              >
                Registrar
              </button>
            </div>

            <div className="rounded-2xl border border-rico-wood/30 bg-white p-5 shadow-suave">
              <h2 className="flex items-center gap-2 text-sm font-bold text-rico-red">
                <Scale size={16} /> Fechar caixa
              </h2>
              <p className="mt-1 text-rotulo text-carvao-suave">
                Conte a gaveta e informe o total (conferência cega).
              </p>
              <div className="mt-3 space-y-3">
                <Campo
                  rotulo="Valor contado (R$)"
                  placeholder="ex.: 327,50"
                  inputMode="decimal"
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                />
                <Campo rotulo="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
              </div>
              <button
                type="button"
                onClick={fechar}
                disabled={ocupado || contado.trim() === ''}
                aria-describedby={contado.trim() === '' ? 'dica-fechar' : undefined}
                className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-rico-red font-semibold text-white transition-colors hover:bg-vinho-profundo disabled:cursor-not-allowed disabled:bg-creme-escuro disabled:text-carvao-suave"
              >
                {ocupado ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <LockKeyhole size={18} aria-hidden="true" />
                )}{' '}
                Fechar caixa
              </button>
              {/* Desabilitado nunca fica mudo: diz o que falta */}
              {contado.trim() === '' && (
                <p id="dica-fechar" className="mt-2 text-center text-rotulo font-medium text-carvao-suave">
                  Informe o valor contado para fechar.
                </p>
              )}
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
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rico-red shadow-suave">
            <Wallet size={26} />
          </span>
          <h1 className="mt-4 font-display text-2xl">Caixa fechado</h1>
          <p className="mt-1 text-sm text-rico-light/80">Abra o caixa com o fundo de troco para começar o turno.</p>
        </div>

        <label className="mt-6 block text-rotulo font-semibold text-rico-wood">
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
          className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-lg bg-rico-red font-semibold text-white transition-colors hover:bg-vinho-profundo disabled:bg-rico-light/12 disabled:text-rico-light/75"
        >
          {ocupado ? <Loader2 size={20} className="animate-spin" /> : <Unlock size={19} />} Abrir caixa
        </button>
      </div>
    </div>
  );
}

function ResultadoFechamento({ resumo }) {
  const dif = resumo.diferenca;
  const cor = dif === 0 ? 'text-ok' : dif > 0 ? 'text-atencao' : 'text-rico-red'; // sobra em âmbar: rico-wood no branco mede 2.2:1
  return (
    <div className="rounded-xl border border-rico-wood/25 bg-white/85 p-5 shadow-media">
      <h2 className="text-sm font-bold text-carvao-claro">Último fechamento</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-carvao-suave">Esperado</dt><dd className="font-bold text-carvao">{moeda(resumo.esperadoDinheiro)}</dd></div>
        <div className="flex justify-between"><dt className="text-carvao-suave">Contado</dt><dd className="font-bold text-carvao">{moeda(resumo.valorContado)}</dd></div>
        <div className="flex justify-between border-t border-rico-wood/20 pt-2">
          <dt className="font-bold text-carvao">Diferença</dt>
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
