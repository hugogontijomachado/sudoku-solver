import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

// Last line of defense: a render-time throw used to unmount the whole tree, leaving the
// bare near-black body (the "tela preta"). This shows a friendly fallback instead.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed during render:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="wrap">
          <div className="card" style={{ marginTop: 40 }}>
            <div className="mlabel">Ops</div>
            <div>Algo deu errado ao exibir esta tela. Recarregue a página para continuar.</div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => location.reload()}>
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
