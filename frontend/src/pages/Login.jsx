import { useEffect, useState } from 'react';
import { LogIn, Loader2, ShieldCheck, ServerCog } from 'lucide-react';
import TecladoNumerico from '../components/TecladoNumerico';
import { api } from '../lib/api';
import { salvarSessao } from '../lib/sessao';
import { notificar, ToasterGlobal } from '../ui/toast';

export default function Login({ aoEntrar, aoTrocarServidor }) {
  const [pin, setPin] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');
  // Muda a cada erro para remontar o campo e tocar a tremida de novo
  const [tentativaErrada, setTentativaErrada] = useState(0);

  function digitar(tecla) {
    if (entrando) return;
    setErro('');
    setPin((p) => (p + tecla).slice(0, 6));
  }

  function apagar() {
    setErro('');
    setPin((p) => p.slice(0, -1));
  }

  function limpar() {
    setErro('');
    setPin('');
  }

  async function entrar() {
    if (pin.length < 4 || entrando) return;
    setEntrando(true);
    try {
      const { token, usuario, avisoPinCurto } = await api.auth.login(pin);
      salvarSessao({ token, usuario });
      if (avisoPinCurto) {
        notificar.brasa('Troque seu PIN', 'Gerente agora usa PIN de 6 dígitos. Troque em Equipe > Trocar meu PIN.');
      }
      if (String(usuario.papel).toUpperCase() === 'GARCOM') window.location.hash = '#/garcom';
      aoEntrar({ token, usuario });
    } catch (e) {
      // O servidor responde "PIN não reconhecido" (401); bloqueio e falta de
      // rede trazem a própria mensagem. O erro aparece junto do campo.
      setErro(e.message || 'PIN não reconhecido');
      setTentativaErrada((n) => n + 1);
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
        apagar();
      } else if (evento.key === 'Escape') {
        evento.preventDefault();
        limpar();
      } else if (evento.key === 'Enter') {
        evento.preventDefault();
        entrar();
      }
    };

    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [pin, entrando]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-carvao-profundo px-4 py-8 text-creme">
      <ToasterGlobal />
      {/* Fundo carvão com um brilho de brasa sutil atrás do logo — sem foto
          desfocada competindo com o teclado. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[18%] h-[420px] w-[520px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgb(226_110_46/0.32),rgb(179_42_42/0.14)_55%,transparent)]"
      />

      <main className="relative z-10 w-full max-w-sm">
        <section className="rounded-3xl border border-creme/10 bg-carvao p-6 shadow-media">
          <img
            src="/logo_clean.png"
            alt="Espetinho do Rico"
            width="845"
            height="466"
            className="mx-auto h-auto w-52 max-w-full"
          />

          <div className="mt-5 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-rico-wood/40 px-3 py-1 text-xs font-bold text-brasa-clara">
              <ShieldCheck size={14} aria-hidden="true" /> Acesso ao PDV
            </p>
            <h1 className="mt-3 font-display text-2xl text-creme">Digite seu PIN</h1>
          </div>

          {/* Pontos: um por dígito digitado, sem fixar 4 ou 6 casas */}
          <div
            key={tentativaErrada}
            className={`mt-5 flex min-h-11 flex-col items-center justify-center ${erro ? 'animate-tremer' : ''}`}
          >
            <div className="flex h-5 items-center justify-center gap-2.5" aria-hidden="true">
              {pin.length === 0 ? (
                <span className="text-rotulo font-medium text-creme/70">Toque nos números</span>
              ) : (
                Array.from({ length: pin.length }, (_, i) => (
                  <span key={i} className="h-3.5 w-3.5 rounded-full bg-brasa-clara" />
                ))
              )}
            </div>
            <p className="sr-only" aria-live="polite">
              {pin.length === 1 ? '1 dígito digitado' : `${pin.length} dígitos digitados`}
            </p>
            {erro && (
              <p role="alert" className="mt-2 text-sm font-semibold text-erro-claro">
                {erro}
              </p>
            )}
          </div>

          <div className="mt-4">
            <TecladoNumerico tema="premium" aoDigitar={digitar} aoApagar={apagar} aoLimpar={limpar} />
          </div>

          <button
            type="button"
            onClick={entrar}
            disabled={pin.length < 4 || entrando}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-rico-red text-base font-bold text-white transition-colors hover:bg-vinho-profundo disabled:cursor-not-allowed disabled:bg-creme/10 disabled:text-creme/75"
          >
            {entrando ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" /> Entrando
              </>
            ) : (
              <>
                <LogIn size={19} aria-hidden="true" /> Entrar
              </>
            )}
          </button>
        </section>

        {aoTrocarServidor && (
          <button
            type="button"
            onClick={aoTrocarServidor}
            className="mx-auto mt-3 flex min-h-11 items-center gap-1.5 rounded-full border border-rico-wood/35 px-4 text-sm font-semibold text-creme/80 transition-colors hover:bg-creme/10 hover:text-creme"
          >
            <ServerCog size={15} aria-hidden="true" /> Trocar servidor
          </button>
        )}
      </main>
    </div>
  );
}
