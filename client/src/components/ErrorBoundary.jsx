import React from 'react';

// Last-resort render guard: a single bad record (e.g. a message with a null
// body) must show a recoverable panel, not a permanently white screen.
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#090d16',
            color: '#e2e8f0',
            gap: '12px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '17px', fontWeight: 700 }}>Something went wrong in the inbox</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '420px', lineHeight: 1.5 }}>
            The app hit an unexpected error. Your conversations are safe on the server — reloading usually fixes this.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload TeamBee
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
