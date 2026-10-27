import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Shield, Clock, MessageSquare, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AgentManagementModal({ isOpen, onClose }) {
  const { token, agent, isAdmin, changePassword } = useAuth();
  const [creating, setCreating] = useState(false);
  const [resetTargetId, setResetTargetId] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [ownPasswords, setOwnPasswords] = useState({ current: '', next: '' });
  const [agents, setAgents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState(null);

  const [automation, setAutomation] = useState({
    autoAssignEnabled: false,
    officeHoursStart: '',
    officeHoursEnd: '',
    officeHoursDays: '1,2,3,4,5',
    officeHoursTimezone: 'Asia/Kolkata',
    awayTemplateName: '',
  });
  const [automationTemplates, setAutomationTemplates] = useState([]);
  const [savingAutomation, setSavingAutomation] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'AGENT',
  });

  const loadData = async () => {
    if (!agent) return;
    setLoading(true);
    try {
      const [agentsRes, metricsRes, settingsRes, templatesRes] = await Promise.all([
        fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/agents/analytics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/tenant/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/templates', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const agentsData = await agentsRes.json();
      const metricsData = await metricsRes.json();
      const settingsData = await settingsRes.json();
      const templatesData = await templatesRes.json();

      if (agentsData.success) setAgents(agentsData.agents);
      if (metricsData.success) setAnalytics(metricsData.metrics);
      if (settingsData.success && settingsData.settings) {
        const s = settingsData.settings;
        setAutomation({
          autoAssignEnabled: Boolean(s.autoAssignEnabled),
          officeHoursStart: s.officeHoursStart || '',
          officeHoursEnd: s.officeHoursEnd || '',
          officeHoursDays: s.officeHoursDays || '1,2,3,4,5',
          officeHoursTimezone: s.officeHoursTimezone || 'Asia/Kolkata',
          awayTemplateName: s.awayTemplateName || '',
        });
      }
      if (templatesData.success) {
        // The away reply sends with no variables, so only zero-variable
        // APPROVED templates are eligible.
        setAutomationTemplates(
          (templatesData.templates || []).filter(
            (t) => t.status === 'APPROVED' && !/\{\{\d+\}\}/.test(t.bodyText || '')
          )
        );
      }
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
  }, [isOpen, agent, token]);

  // Escape closes the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSaveAutomation = async () => {
    setSavingAutomation(true);
    setMessage(null);
    try {
      const res = await fetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          autoAssignEnabled: automation.autoAssignEnabled,
          officeHoursStart: automation.officeHoursStart || null,
          officeHoursEnd: automation.officeHoursEnd || null,
          officeHoursDays: automation.officeHoursDays || null,
          officeHoursTimezone: automation.officeHoursTimezone || 'Asia/Kolkata',
          awayTemplateName: automation.awayTemplateName || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save automation settings');
      setMessage({ type: 'success', text: 'Automation settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingAutomation(false);
    }
  };

  const toggleAutomationDay = (day) => {
    const days = new Set(
      (automation.officeHoursDays || '')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean)
    );
    if (days.has(String(day))) days.delete(String(day));
    else days.add(String(day));
    setAutomation((prev) => ({
      ...prev,
      officeHoursDays: [...days].sort().join(','),
    }));
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
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
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (targetAgent) => {
    if (!resetPasswordValue || resetPasswordValue.length < 10) {
      setMessage({ type: 'error', text: 'New password must be at least 10 characters' });
      return;
    }
    try {
      const res = await fetch(`/api/agents/${targetAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to reset password');
      setMessage({
        type: 'success',
        text: `Password reset for ${targetAgent.name}. Their existing sessions have been signed out.`,
      });
      setResetTargetId(null);
      setResetPasswordValue('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();
    try {
      await changePassword(ownPasswords.current, ownPasswords.next);
      setMessage({ type: 'success', text: 'Your password was updated. Other sessions have been signed out.' });
      setOwnPasswords({ current: '', next: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" role="dialog" aria-modal="true" aria-label="Staff agents" style={{ maxWidth: '720px' }}>
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
                color: '#4338ca',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', color: 'var(--text-main)' }}>Staff Agents & Operational Metrics</h3>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Monitor agent response speeds, active workloads, and invite team members
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px' }} aria-label="Close staff agents">
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
            <div className="grid-stats-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OPEN CHATS</div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669', marginTop: '2px' }}>
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
                  {analytics.avgResponseTimeSec == null ? '—' : `${analytics.avgResponseTimeSec}s`}
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
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#4338ca', marginTop: '2px' }}>
                  {analytics.firstContactResolutionRate}
                </div>
              </div>
            </div>
          )}

          {/* Automation: round-robin auto-assign + office-hours away reply */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>
              ⚙️ Automation
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
              New unassigned chats can be auto-assigned round-robin, and customers who write outside office
              hours can receive one automatic template reply (max once per 12 hours per chat).
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-main)', cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={automation.autoAssignEnabled}
                disabled={!isAdmin}
                onChange={(e) => setAutomation((p) => ({ ...p, autoAssignEnabled: e.target.checked }))}
              />
              Auto-assign new chats round-robin across active agents
            </label>

            <div className="grid-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Office hours start</label>
                <input
                  type="time"
                  value={automation.officeHoursStart}
                  disabled={!isAdmin}
                  onChange={(e) => setAutomation((p) => ({ ...p, officeHoursStart: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '7px', padding: '7px 9px', color: 'var(--text-main)', fontSize: '12.5px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Office hours end</label>
                <input
                  type="time"
                  value={automation.officeHoursEnd}
                  disabled={!isAdmin}
                  onChange={(e) => setAutomation((p) => ({ ...p, officeHoursEnd: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '7px', padding: '7px 9px', color: 'var(--text-main)', fontSize: '12.5px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>Working days</label>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => {
                  const active = (automation.officeHoursDays || '').split(',').includes(String(day));
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => toggleAutomationDay(day)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        border: '1px solid',
                        borderColor: active ? 'rgba(37, 211, 102, 0.5)' : 'var(--border-medium)',
                        background: active ? 'rgba(37, 211, 102, 0.15)' : 'transparent',
                        color: active ? '#25D366' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Away reply template (no variables)</label>
                <select
                  value={automation.awayTemplateName}
                  disabled={!isAdmin}
                  onChange={(e) => setAutomation((p) => ({ ...p, awayTemplateName: e.target.value }))}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '7px', padding: '7px 9px', color: 'var(--text-main)', fontSize: '12.5px' }}
                >
                  <option value="">None — no away reply</option>
                  {automationTemplates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Timezone</label>
                <input
                  type="text"
                  value={automation.officeHoursTimezone}
                  disabled={!isAdmin}
                  onChange={(e) => setAutomation((p) => ({ ...p, officeHoursTimezone: e.target.value }))}
                  placeholder="Asia/Kolkata"
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '7px', padding: '7px 9px', color: 'var(--text-main)', fontSize: '12.5px' }}
                />
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={handleSaveAutomation}
                disabled={savingAutomation}
                className="btn btn-primary"
                style={{ padding: '7px 14px', fontSize: '12.5px' }}
              >
                {savingAutomation ? 'Saving…' : 'Save automation'}
              </button>
            )}
          </div>

          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>
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
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-main)' }}>Invite New Agent Account</div>
              <div className="grid-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-main)',
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
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                  }}
                />
              </div>
              <div className="grid-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="password"
                  placeholder="Temporary Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                  }}
                />
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                  }}
                >
                  <option value="AGENT">Role: Staff Agent</option>
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
                <button type="submit" disabled={creating} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* Agents List Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {agents.map((a) => (
              <div
                key={a.id}
                className="agent-row"
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
                    <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text-main)' }}>{a.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.email}</div>
                  </div>
                </div>

                <div className="agent-row-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(15, 23, 42, 0.06)',
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

                  {agent?.role === 'ADMIN' && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetTargetId(resetTargetId === a.id ? null : a.id);
                        setResetPasswordValue('');
                      }}
                      className="btn btn-ghost"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      Reset password
                    </button>
                  )}
                </div>
                {agent?.role === 'ADMIN' && resetTargetId === a.id && (
                  <div className="agent-reset-row" style={{ display: 'flex', gap: '8px', marginTop: '10px', width: '100%' }}>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="New password (min 10 characters)"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'var(--bg-app)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '7px 10px',
                        color: 'var(--text-main)',
                        fontSize: '12px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleResetPassword(a)}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Set password
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Own password */}
          <form
            onSubmit={handleChangeOwnPassword}
            style={{
              marginTop: '18px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-main)' }}>Change my password</div>
            <div className="grid-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Current password"
                value={ownPasswords.current}
                onChange={(e) => setOwnPasswords({ ...ownPasswords, current: e.target.value })}
                required
                style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                }}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password (min 10 characters)"
                value={ownPasswords.next}
                onChange={(e) => setOwnPasswords({ ...ownPasswords, next: e.target.value })}
                required
                style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                Update password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
