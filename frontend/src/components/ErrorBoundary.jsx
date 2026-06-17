import { Component } from 'react';

/*
 * Captura erros de renderização (inclusive falha ao carregar um chunk lazy)
 * e mostra um fallback amigável em vez de tela branca.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro na interface:', erro, info?.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-rico-dark px-6 text-center text-rico-light">
        <h1 className="font-display text-2xl">Algo deu errado na tela</h1>
        <p className="max-w-xs text-sm text-rico-light/60">
          Recarregue a página. Se o problema continuar, avise o suporte.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-rico-red px-5 py-3 font-bold text-rico-light shadow-brasa transition hover:-translate-y-0.5 active:translate-y-0"
        >
          Recarregar
        </button>
      </div>
    );
  }
}
