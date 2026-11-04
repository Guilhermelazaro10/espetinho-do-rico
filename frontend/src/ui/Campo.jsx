import { useId } from 'react';
import { ChevronDown } from 'lucide-react';

// Campo de formulário único: rótulo, input/textarea/select, dica e erro.
// tom="escuro" é para os painéis carvão (formulário do delivery, cardápio admin).
const TONS = {
  claro: {
    rotulo: 'text-carvao-suave',
    dica: 'text-carvao-suave',
    erro: 'text-rico-red',
  },
  escuro: {
    rotulo: 'text-rico-light/75',
    dica: 'text-rico-light/70',
    erro: 'text-erro-claro',
  },
};

const BASE_CONTROLE =
  'w-full min-h-11 rounded-lg bg-white px-3 text-sm font-medium text-carvao ring-inset outline-none transition-shadow focus:ring-2 focus:ring-rico-red disabled:bg-creme-escuro disabled:text-carvao-suave';

export default function Campo({
  rotulo,
  como = 'input',
  dica,
  erro,
  tom = 'claro',
  id,
  className = '',
  children,
  ...controle
}) {
  const idGerado = useId();
  const idCampo = id ?? idGerado;
  const idDica = dica ? `${idCampo}-dica` : null;
  const idErro = erro ? `${idCampo}-erro` : null;
  const t = TONS[tom];
  const descricao = [idErro, idDica].filter(Boolean).join(' ') || undefined;
  // Uma cor de anel só por vez: se as duas classes coexistem, quem vence é a
  // ordem no CSS, não a do className (o erro sumia em campo sem foco).
  const borda = erro ? 'ring-2 ring-rico-red' : 'ring-1 ring-rico-wood/45';

  const props = {
    id: idCampo,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': descricao,
    ...controle,
  };

  let elemento;
  if (como === 'textarea') {
    elemento = <textarea rows={2} {...props} className={`${BASE_CONTROLE} ${borda} py-2.5 leading-snug`} />;
  } else if (como === 'select') {
    // appearance-none + seta própria: o select fica igual aos outros campos
    elemento = (
      <div className="relative">
        <select {...props} className={`${BASE_CONTROLE} ${borda} appearance-none pr-10`}>
          {children}
        </select>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-carvao-suave"
        />
      </div>
    );
  } else {
    elemento = <input {...props} className={`${BASE_CONTROLE} ${borda}`} />;
  }

  return (
    <div className={`min-w-0 ${className}`}>
      {rotulo && (
        <label htmlFor={idCampo} className={`mb-1 block text-rotulo font-semibold ${t.rotulo}`}>
          {rotulo}
        </label>
      )}
      {elemento}
      {erro && (
        <p id={idErro} className={`mt-1 text-rotulo font-semibold ${t.erro}`}>
          {erro}
        </p>
      )}
      {dica && !erro && (
        <p id={idDica} className={`mt-1 text-xs font-medium ${t.dica}`}>
          {dica}
        </p>
      )}
    </div>
  );
}
