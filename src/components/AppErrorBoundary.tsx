import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error) => void;
};

type State = {
  error: Error | null;
  generation: number;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    generation: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RoadGuard] Rendering error:', error, errorInfo.componentStack);
    this.props.onError?.(error);
  }

  private retry = () => {
    this.setState((state) => ({
      error: null,
      generation: state.generation + 1,
    }));
  };

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.retry);
    }

    return (
      <React.Fragment key={this.state.generation}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
