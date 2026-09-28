import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
         return this.props.fallback;
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-app-bg text-text-primary p-6 w-full h-full min-h-[200px] border border-red-500/20 rounded-xl bg-red-500/5">
          <AlertTriangle size={48} className="text-red-500 mb-4 opacity-80" />
          <h2 className="text-lg font-bold text-red-500 mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary max-w-md text-center mb-6">
            The {this.props.name || 'component'} encountered an unexpected error and had to stop rendering to prevent the entire app from crashing.
          </p>
          {this.state.error && (
            <div className="bg-surface-bg border border-border-strong rounded-md p-4 w-full max-w-2xl overflow-auto mb-6">
              <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            </div>
          )}
          <button
            onClick={() => {
              // Attempt to recover by reloading window if it's the root app, otherwise just reset state
              if (this.props.name === 'App') {
                window.location.reload();
              } else {
                this.setState({ hasError: false, error: null });
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-border-strong text-text-primary rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCcw size={14} /> {this.props.name === 'App' ? 'Reload App' : 'Try Again'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
