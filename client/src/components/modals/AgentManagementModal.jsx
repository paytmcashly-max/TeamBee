import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Shield, Clock, MessageSquare, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AgentManagementModal({ isOpen, onClose }) {
  const { token, isAdmin } = useAuth();
  const [agents, setAgents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'AGENT',
  });

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [agentsRes, metricsRes] = await Promise.all([
        fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/agents/analytics', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const agentsData = await agentsRes.json();
      const metricsData = await metricsRes.json();

      if (agentsData.success) setAgents(agentsData.agents);
      if (metricsData.success) setAnalytics(metricsData.metrics);
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, token]);

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Agent ${data.agent.name} created successfully!` });
        setShowAddForm(false);
        setFormData({ name: '', email: '', password: '', role: 'AGENT' });
        loadData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create agent' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '720px' }}>
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a5b4fc',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: '#fff' }}>Staff Agents & Operational Metrics</h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Monitor agent response speeds, active workloads, and invite team members
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {message && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '12.5px',
                background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: message.type === 'success' ? '#34d399' : '#fca5a5',
              }}
            >
              {message.text}
            </div>
          )}

          {/* Operational Metrics Cards */}
          {analytics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OPEN CHATS</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#34d399', marginTop: '2px' }}>
                  {analytics.openChats}
                </div>
              </div>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UNASSIGNED POOL</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#fbbf24', marginTop: '2px' }}>
                  {analytics.unassignedChats}
                </div>
              </div>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AVG RESPONSE SLA</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
                  {analytics.avgResponseTimeSec}s
                </div>
              </div>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RESOLUTION RATE</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#a5b4fc', marginTop: '2px' }}>
                  {analytics.firstContactResolutionRate}
                </div>
              </div>
            </div>
          )}

          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
              Active Staff Roster ({agents.length})
            </span>
            {isAdmin && !showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <Plus size={14} /> Add Staff Agent
              </button>
            )}
          </div>

          {/* Add Agent Form */}
          {showAddForm && (
            <form
              onSubmit={handleCreateAgent}
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                border: '1px solid var(--border-medium)',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff' }}>Invite New Agent Account</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Full Name (e.g. Dr. Kavita)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    background: '#090d16',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <input
                  type="email"
                  placeholder="Official Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  style={{
                    background: '#090d16',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="password"
                  placeholder="Temporary Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  style={{
                    background: '#090d16',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    background: '#090d16',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                >
                  <option value="AGENT">Role: Staff Agent</option>
                  <option value="ADMIN">Role: Tenant Admin</option>
                  <option value="SUPERVISOR">Role: Team Supervisor</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* Agents List Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agents.map((a) => (
              <div
                key={a.id}
                style={{
                  background: 'var(--bg-surface)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#1e293b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        color: '#94a3b8',
                        fontSize: '14px',
                      }}
                    >
                      {a.name.charAt(0)}
                    </div>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-1px',
                        right: '-1px',
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        background: a.status === 'ONLINE' ? '#10b981' : a.status === 'BUSY' ? '#f59e0b' : '#64748b',
                        border: '1.5px solid #141d30',
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13.5px', color: '#fff' }}>{a.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.08)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {a.activeChatCount} active chat(s)
                  </span>

                  <span
                    className={a.role === 'ADMIN' ? 'badge badge-admin' : 'badge badge-open'}
                    style={{ fontSize: '10px' }}
                  >
                    {a.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
