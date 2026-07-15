import React, { ErrorInfo, ReactNode } from 'react';
import * as Icons from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error("ErrorBoundary caught an active runtime crash:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    // Fire a custom event or reload the workspace if needed
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: "Error boundary reset. Attempting to reload workspace..." }
    }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full w-full items-center justify-center p-6 bg-slate-950 font-sans">
          <div className="w-full max-w-xl rounded-2xl border border-rose-500/20 bg-slate-950/80 p-6 shadow-2xl relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl" />

            <div className="relative flex items-start space-x-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <Icons.AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black text-xs text-white uppercase tracking-wider">
                  DASHBOARD TAB RENDER OUTAGE
                </h3>
                <p className="text-[10px] font-mono text-rose-400 mt-1 uppercase tracking-wider">
                  Operational Core Exception Intercepted
                </p>
                <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                  A high-frequency rendering crash or uncaught runtime exception occurred in this isolated operational console panel. The SupportPilot protection layer prevented this crash from bringing down the entire workspace shell.
                </p>

                {/* Error Message */}
                <div className="mt-4 rounded-lg bg-slate-900/50 border border-slate-900/80 p-3 font-mono text-[10px] text-rose-300">
                  <div className="font-bold uppercase tracking-wider text-[8.5px] text-slate-500 mb-1">
                    Error Description
                  </div>
                  <p className="break-all leading-normal">
                    {this.state.error?.toString() || 'Unknown runtime error'}
                  </p>
                </div>

                {/* Stack Trace Toggle */}
                {this.state.errorInfo && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                      className="flex items-center space-x-1 text-[9px] font-mono font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      <span>{this.state.showDetails ? 'Hide' : 'Show'} Telemetry Stack Trace</span>
                      <Icons.ChevronDown className={`h-3 w-3 transform transition-transform ${this.state.showDetails ? 'rotate-180' : ''}`} />
                    </button>

                    {this.state.showDetails && (
                      <pre className="mt-2.5 max-h-40 overflow-auto rounded-lg bg-slate-900/30 border border-slate-900 p-3 font-mono text-[8px] text-slate-500 leading-normal select-text whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-5 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={this.handleReset}
                    className="flex items-center space-x-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 hover:bg-rose-600/35 px-4 py-2 text-xs font-bold text-rose-300 transition-all cursor-pointer shadow-lg shadow-rose-600/10"
                  >
                    <Icons.RefreshCw className="h-3.5 w-3.5" />
                    <span>Recover Module Tab</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="flex items-center space-x-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <Icons.Radio className="h-3.5 w-3.5" />
                    <span>Full Kernel Reboot</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
