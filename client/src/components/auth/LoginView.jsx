import React, { useState } from 'react';
import { MessageSquare, Shield, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('rahul.verma@apexeducare.in');
  const [password, setPassword] = useState('Admin@123');
  const [tenantSlug, setTenantSlug] = useState('apex-educare');
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

  const handleDemoLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    setError(null);
    login(demoEmail, demoPassword, 'apex-educare').catch((err) => {
      setError(err.message);
      setLoading(false);
    });
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
          <h1 style={{ fontSize: '22px', color: '#fff', fontWeight: '800' }}>ChatFlow</h1>
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

        {/* Instant Role-Based Demo Persona Switcher */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textAlign: 'center',
              marginBottom: '10px',
            }}
          >
            Instant Persona Quick Switch (Role-Based Testing)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleDemoLogin('rahul.verma@apexeducare.in', 'Admin@123')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '8px 12px', fontSize: '12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={14} style={{ color: '#a5b4fc' }} />
                <span>Rahul Verma (Admin View)</span>
              </div>
              <span className="badge badge-admin" style={{ fontSize: '9px' }}>
                Full Omniscient
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin('priya.sharma@apexeducare.in', 'Agent@123')}
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '8px 12px', fontSize: '12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={14} style={{ color: '#34d399' }} />
                <span>Priya Sharma (Staff Agent)</span>
              </div>
              <span className="badge badge-open" style={{ fontSize: '9px' }}>
                Mine + Unassigned
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
