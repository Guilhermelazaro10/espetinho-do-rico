import toast, { Toaster } from 'react-hot-toast';
import { CheckCircle2, XCircle, Flame, Info, X } from 'lucide-react';

/*
 * Sistema de notificações — Espetinho do Rico
 * Toasts 100% customizados: card escuro carvão, barra de acento,
 * ícone por tipo e animação de entrada/saída própria.
 */

const TIPOS = {
  sucesso: {
    Icone: CheckCircle2,
    icone: 'text-emerald-400',
    barra: 'bg-emerald-500',
  },
  erro: {
    Icone: XCircle,
    icone: 'text-red-400',
    barra: 'bg-rico-red-claro',
  },
  info: {
    Icone: Info,
    icone: 'text-sky-400',
    barra: 'bg-sky-500',
  },
  brasa: {
    Icone: Flame,
    icone: 'text-brasa-clara',
    barra: 'bg-brasa-gradiente',
  },
};

function ToastCard({ t, tipo, titulo, mensagem }) {
  const { Icone, icone, barra } = TIPOS[tipo];
  return (
    <div
      className={`${t.visible ? 'animate-toast-in' : 'animate-toast-out'}
        pointer-events-auto flex w-80 overflow-hidden rounded-xl bg-carvao
        shadow-flutuante ring-1 ring-rico-light/10`}
    >
      <div className={`w-1.5 shrink-0 ${barra}`} />
      <div className="flex flex-1 items-start gap-3 px-4 py-3.5">
        <Icone size={20} className={`mt-0.5 shrink-0 ${icone}`} strokeWidth={2.25} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-rico-light">{titulo}</p>
          {mensagem && (
            <p className="mt-0.5 text-[13px] leading-snug text-rico-light/70">{mensagem}</p>
          )}
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="shrink-0 rounded-md p-1 text-rico-light/40 transition hover:bg-rico-light/10 hover:text-rico-light"
          aria-label="Fechar notificação"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function disparar(tipo, titulo, mensagem, opcoes = {}) {
  return toast.custom(
    (t) => <ToastCard t={t} tipo={tipo} titulo={titulo} mensagem={mensagem} />,
    { duration: 3500, ...opcoes }
  );
}

export const notificar = {
  sucesso: (titulo, mensagem, opcoes) => disparar('sucesso', titulo, mensagem, opcoes),
  erro: (titulo, mensagem, opcoes) => disparar('erro', titulo, mensagem, opcoes),
  info: (titulo, mensagem, opcoes) => disparar('info', titulo, mensagem, opcoes),
  brasa: (titulo, mensagem, opcoes) => disparar('brasa', titulo, mensagem, opcoes),
};

export function ToasterGlobal() {
  return <Toaster position="top-right" gutter={10} containerStyle={{ top: 18, right: 18 }} />;
}
