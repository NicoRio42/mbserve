import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo): void {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return <div>{this.state.error.message}</div>;
    }

    return this.props.children;
  }
}

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <AppErrorBoundary>
    <Suspense fallback={<div>Loading map configuration…</div>}>
      <App />
    </Suspense>
  </AppErrorBoundary>,
);
