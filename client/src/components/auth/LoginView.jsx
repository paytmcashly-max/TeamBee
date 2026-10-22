import React, { useState } from 'react';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password, tenantSlug);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#070a12',
        position: 'relative',
        overflow: 'hidden',
        backgroundImage:
          'radial-gradient(circle at 50% 20%, rgba(37, 211, 102, 0.08) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 50%)',
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '460px',
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#062B18',
              margin: '0 auto 14px auto',
              boxShadow: '0 8px 24px rgba(37, 211, 102, 0.35)',
            }}
          >
            <MessageSquare size={28} />
          </div>
          <h1 style={{ fontSize: '22px', color: '#fff', fontWeight: '800' }}>TeamBee</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            B2B Multi-Agent WhatsApp Shared Team Inbox
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '12.5px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
              Staff Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#0b1120',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#fff',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#0b1120',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '12px 14px',
                color: '#fff',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '13.5px', marginTop: '6px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In to WhatsApp Inbox'}
            <ArrowRight size={15} />
          </button>
        </form>

      </div>
    </div>
  );
}
