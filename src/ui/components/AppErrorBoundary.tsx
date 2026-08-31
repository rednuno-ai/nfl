import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryState {
  failed: boolean;
}

/** A last-resort recovery view. Saved careers stay in the repository, so a
 * reload is a safe way to recover from a rendering failure rather than a
 * dead-end blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("GRIDIRON LIFE rendering error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-error-page">
        <div className="card">
          <p className="screen-eyebrow">RECOVERY MODE</p>
          <h1 className="page-title">We hit a timeout.</h1>
          <p className="muted">Your local saves were not removed. Reload to return to the latest saved career.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload game</button>
        </div>
      </main>
    );
  }
}
