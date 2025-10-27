'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div 
          className="h-screen flex items-center justify-center p-4"
          style={{ background: 'var(--background)' }}
        >
          <div 
            className="max-w-md p-8 rounded-md text-center"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 className="text-heading mb-4" style={{ color: 'var(--text-primary)' }}>
              Something went wrong
            </h2>
            <p className="text-body mb-6" style={{ color: 'var(--text-secondary)' }}>
              We encountered an unexpected error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-sm transition-all duration-fast"
              style={{
                background: 'var(--accent)',
                color: '#ffffff',
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
