import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Render failure contained:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-loading-screen">
          <div className="app-loading-card" style={{ maxWidth: '420px', textAlign: 'center', padding: '28px' }}>
            <span className="app-loading-title">Something went wrong in the workspace</span>
            <span className="app-loading-subtitle" style={{ textTransform: 'none', letterSpacing: 0, lineHeight: 1.5 }}>
              Your conversations are safely stored on the server. Reloading usually resolves transient display errors.
            </span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary"
              style={{ marginTop: '8px' }}
            >
              Reload TeamBee
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
