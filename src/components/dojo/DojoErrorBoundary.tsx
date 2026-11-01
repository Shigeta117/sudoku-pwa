import { Component, ReactNode } from 'react';

interface Props {
  onClose: () => void;
  children: ReactNode;
}

/**
 * The dojo is a lazy chunk; if it cannot be fetched (offline before the service worker
 * cached it), show a closable message instead of unmounting the whole game.
 */
export class DojoErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="解法道場"
        className="fixed inset-0 z-40 bg-slate-950/60 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 text-sm text-slate-800 dark:text-slate-100">
          <p>解法道場を読み込めませんでした。通信できる状態でもう一度開いてください。</p>
          <button
            type="button"
            onClick={this.props.onClose}
            className="mt-4 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
          >
            閉じる
          </button>
        </div>
      </div>
    );
  }
}
