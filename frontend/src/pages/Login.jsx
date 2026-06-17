import { useEffect, useState } from 'react';
import { LogIn, Loader2, ShieldCheck, ServerCog } from 'lucide-react';
import TecladoNumerico from '../components/TecladoNumerico';
import { api } from '../lib/api';
import { salvarSessao } from '../lib/sessao';
import { notificar, ToasterGlobal } from '../ui/toast';

export default function Login({ aoEntrar, aoTrocarServidor }) {
  const [pin, setPin] = useState('');
  const [entrando, setEntrando] = useState(false);

  function digitar(tecla) {
    if (entrando) return;
    setPin((p) => (p + tecla).slice(0, 6));
  }

  async function entrar() {
    if (pin.length < 4 || entrando) return;
    setEntrando(true);
    try {
      const { token, usuario } = await api.auth.login(pin);
      salvarSessao({ token, usuario });
      if (String(usuario.papel).toUpperCase() === 'GARCOM') window.location.hash = '#/garcom';
      aoEntrar({ token, usuario });
    } catch (e) {
      notificar.erro('Nao foi possivel entrar', e.message);
      setPin('');
    } finally {
      setEntrando(false);
    }
  }

  useEffect(() => {
    const aoTeclar = (evento) => {
      if (/^\d$/.test(evento.key)) {
        evento.preventDefault();
        digitar(evento.key);
      } else if (evento.key === 'Backspace') {
        evento.preventDefault();
        setPin((p) => p.slice(0, -1));
      } else if (evento.key === 'Escape') {
        evento.preventDefault();
        setPin('');
      } else if (evento.key === 'Enter') {
        evento.preventDefault();
        entrar();
      }
    };

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [pin, entrando]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-login-rico px-5 py-8 text-rico-light">
      <ToasterGlobal />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgb(63_43_29/0.22)_40%,rgb(63_43_29/0.72)_100%)]" />

      <main className="relative z-10 w-full max-w-sm">
        <section className="rounded-xl border border-rico-wood/45 bg-rico-dark/72 p-6 shadow-flutuante backdrop-blur-md">
          <img
            src="/logo_clean.png"
            alt="Espetinho do Rico"
            className="mx-auto h-auto w-64 max-w-full drop-shadow-[0_12px_26px_rgb(0_0_0/0.35)]"
          />

          <div className="mt-6 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-rico-wood/40 bg-rico-light/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-rico-wood">
              <ShieldCheck size={13} /> Acesso ao PDV
            </p>
            <h1 className="mt-3 font-display text-2xl text-rico-light">Digite seu PIN</h1>
          </div>

          <div className="mt-5 flex h-8 items-center justify-center gap-3" aria-label={`${pin.length} digitos digitados`}>
            {Array.from({ length: 6 }, (_, i) => (
              <span
                key={i}
                className={`h-3.5 rounded-full transition-all duration-200 ${
                  i < pin.length
                    ? 'w-8 bg-rico-red shadow-brasa'
                    : i < 4
                      ? 'w-3.5 bg-rico-light/20'
                      : 'w-3.5 bg-rico-light/10'
                }`}
              />
            ))}
          </div>

          <div className="mt-5">
            <TecladoNumerico
              tema="premium"
              aoDigitar={digitar}
              aoApagar={() => setPin((p) => p.slice(0, -1))}
              aoLimpar={() => setPin('')}
            />
          </div>

          <button
            onClick={entrar}
            disabled={pin.length < 4 || entrando}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-rico-red text-base font-extrabold text-rico-light shadow-brasa transition hover:-translate-y-0.5 hover:bg-vinho-profundo active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {entrando ? (
              <>
                <Loader2 size={21} className="animate-spin" /> Entrando
              </>
            ) : (
              <>
                <LogIn size={19} /> Entrar
              </>
            )}
          </button>
        </section>

        <p className="mt-4 text-center text-[11px] font-semibold text-rico-light/55">
          Dev: 1111 garcom | 9999 gerente
        </p>

        {aoTrocarServidor && (
          <button
            onClick={aoTrocarServidor}
            className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-rico-wood/35 px-3 py-1.5 text-[11px] font-bold text-rico-light/60 transition hover:bg-rico-light/10 hover:text-rico-light"
          >
            <ServerCog size={13} /> Trocar servidor
          </button>
        )}
      </main>
    </div>
  );
}
