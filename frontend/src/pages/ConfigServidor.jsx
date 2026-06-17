import { useEffect, useState } from 'react';
import { Wifi, Loader2, ServerCog, ArrowRight, Info, Radar, Search } from 'lucide-react';
import { salvarServidor, testarServidor, obterServidor } from '../lib/servidor';
import { localizarPDV, buscarEmTodaRede } from '../lib/descoberta';
import { notificar, ToasterGlobal } from '../ui/toast';

/*
 * Conexão com o PDV (app nativo). Ao abrir, tenta achar o servidor sozinho
 * (endereço salvo → varredura da sub-rede). Só cai no formulário manual se a
 * descoberta automática não encontrar nada.
 */
function valoresIniciais() {
  try {
    const u = new URL(obterServidor());
    return { ip: u.hostname, porta: u.port || '3001' };
  } catch {
    return { ip: '', porta: '3001' };
  }
}

function pct(p) {
  return p.total ? Math.round((p.feitos / p.total) * 100) : 0;
}

export default function ConfigServidor({ aoConectar }) {
  const inicial = valoresIniciais();
  const [fase, setFase] = useState('procurando'); // procurando | manual
  const [ip, setIp] = useState(inicial.ip);
  const [porta, setPorta] = useState(inicial.porta);
  const [testando, setTestando] = useState(false);
  const [varrendo, setVarrendo] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });

  function conectar(base, nome) {
    salvarServidor(base);
    notificar.sucesso('PDV conectado!', nome ? `Conectado a ${nome}` : base);
    aoConectar();
  }

  // Descoberta automática ao abrir
  useEffect(() => {
    let vivo = true;
    (async () => {
      const achado = await localizarPDV({
        aoProgresso: (feitos, total) => vivo && setProgresso({ feitos, total }),
      });
      if (!vivo) return;
      if (achado) conectar(achado.base, achado.nome);
      else setFase('manual');
    })();
    return () => {
      vivo = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function conectarManual() {
    if (testando || !ip.trim()) return;
    setTestando(true);
    try {
      const { base, dados } = await testarServidor(`${ip.trim()}:${porta.trim() || '3001'}`);
      conectar(base, dados.nome);
    } catch (e) {
      notificar.erro('Não foi possível conectar', e.message);
    } finally {
      setTestando(false);
    }
  }

  async function buscaAmpla() {
    if (varrendo) return;
    setVarrendo(true);
    setProgresso({ feitos: 0, total: 0 });
    try {
      const achado = await buscarEmTodaRede({
        aoProgresso: (feitos, total) => setProgresso({ feitos, total }),
      });
      if (achado) conectar(achado.base, achado.nome);
      else notificar.erro('Não encontrei o PDV', 'Confira se o PDV está aberto e na mesma Wi-Fi');
    } finally {
      setVarrendo(false);
    }
  }

  // ---- Tela de busca automática inicial ----
  if (fase === 'procurando') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-rico-dark px-6 text-rico-light">
        <ToasterGlobal />
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-rico-red/30" />
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-rico-red shadow-brasa">
            <Radar size={34} className="text-rico-light" />
          </span>
        </span>
        <h1 className="mt-6 font-display text-2xl">Procurando o PDV…</h1>
        <p className="mt-1 text-sm text-rico-light/60">Buscando o servidor na sua rede</p>
        {progresso.total > 0 && (
          <div className="mt-5 w-full max-w-xs">
            <div className="h-1.5 overflow-hidden rounded-full bg-rico-light/10">
              <div
                className="h-full rounded-full bg-brasa-gradiente transition-all"
                style={{ width: `${pct(progresso)}%` }}
              />
            </div>
            <p className="mt-1.5 text-center text-[11px] text-rico-light/40">
              {progresso.feitos} de {progresso.total} endereços
            </p>
          </div>
        )}
      </div>
    );
  }

  // ---- Formulário manual (fallback) ----
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-rico-dark px-5 py-8 text-rico-light">
      <ToasterGlobal />

      <main className="relative z-10 w-full max-w-sm">
        <section className="rounded-2xl border border-rico-wood/45 bg-rico-dark/70 p-6 shadow-flutuante backdrop-blur-md">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rico-red shadow-brasa">
              <ServerCog size={26} className="text-rico-light" />
            </span>
            <h1 className="mt-4 font-display text-2xl text-rico-light">Conectar ao PDV</h1>
            <p className="mt-1 text-sm text-rico-light/60">
              Não achei automaticamente. Busque na rede ou informe o IP do PDV.
            </p>
          </div>

          {/* Busca automática na rede */}
          <button
            onClick={buscaAmpla}
            disabled={varrendo || testando}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-rico-wood/45 bg-rico-light/5 text-sm font-bold text-rico-light transition hover:bg-rico-light/10 disabled:opacity-50"
          >
            {varrendo ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Procurando… {pct(progresso)}%
              </>
            ) : (
              <>
                <Search size={18} /> Procurar o PDV na rede
              </>
            )}
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-rico-light/35">
            <span className="h-px flex-1 bg-rico-wood/25" /> ou manual <span className="h-px flex-1 bg-rico-wood/25" />
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-rico-wood">
                IP do servidor
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                placeholder="192.168.0.10"
                className="mt-1 w-full rounded-xl border border-rico-wood/35 bg-rico-light/8 px-4 py-3 text-lg font-bold text-rico-light outline-none placeholder:text-rico-light/25 focus:border-rico-red"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-rico-wood">
                Porta
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={porta}
                onChange={(e) => setPorta(e.target.value.replace(/\D/g, ''))}
                placeholder="3001"
                className="mt-1 w-full rounded-xl border border-rico-wood/35 bg-rico-light/8 px-4 py-3 text-lg font-bold text-rico-light outline-none placeholder:text-rico-light/25 focus:border-rico-red"
              />
            </div>
          </div>

          <button
            onClick={conectarManual}
            disabled={!ip.trim() || testando || varrendo}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-rico-red text-base font-extrabold text-rico-light shadow-brasa transition hover:-translate-y-0.5 hover:bg-vinho-profundo active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testando ? (
              <>
                <Loader2 size={21} className="animate-spin" /> Testando conexão…
              </>
            ) : (
              <>
                <Wifi size={19} /> Conectar <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-rico-wood/25 bg-rico-light/5 px-3 py-2.5 text-[12px] leading-relaxed text-rico-light/60">
            <Info size={15} className="mt-0.5 shrink-0 text-rico-wood" />
            <span>
              No desktop, veja o IPv4 com <b>ipconfig</b> (algo como{' '}
              <span className="font-mono">192.168.x.x</span>). Celular e PDV precisam estar na{' '}
              <b>mesma rede Wi-Fi</b>.
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
