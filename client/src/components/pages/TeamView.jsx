import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { apiFetch } from '../../services/apiClient';

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  const array = new Uint32Array(14);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  }
  return Array.from(array, (n) => alphabet[n % alphabet.length]).join('');
}

export default function TeamView() {
  const { agent: currentAgent, tenant, isManager } = useAuth();
  const { onlineAgentIds } = useSocket();

  const [agents, setAgents] = useState([]);
  const [maxSeats, setMaxSeats] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL');
  const [feedback, setFeedback] = useState(null);

  // Add Teammate Form (backend POST /api/agents creates AGENT or SUPERVISOR)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('AGENT');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      const [agentData, settingsData] = await Promise.all([
        apiFetch('/api/agents'),
        apiFetch('/api/tenant/settings').catch(() => null),
      ]);
      setAgents(agentData.agents || []);
      if (settingsData?.settings?.billing?.maxAgents) {
        setMaxSeats(settingsData.settings.billing.maxAgents);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  const onlineSet = useMemo(() => new Set(onlineAgentIds || []), [onlineAgentIds]);

  const metrics = useMemo(() => {
    const activeMembers = agents.filter((a) => a.isActive);
    const adminsCount = agents.filter((a) => a.role === 'ADMIN' || a.role === 'SUPERVISOR').length;
    const regularCount = agents.filter((a) => a.role === 'AGENT').length;
    const availableCount = activeMembers.filter((a) => onlineSet.has(a.id) || a.status === 'ONLINE').length;
    const openConversations = agents.reduce((sum, a) => sum + (a.activeChatCount || 0), 0);
    return {
      total: agents.length,
      adminsCount,
      regularCount,
      availableCount,
      openConversations,
      seatsRemaining: Math.max(0, maxSeats - activeMembers.length),
    };
  }, [agents, onlineSet, maxSeats]);

  const filteredAgents = useMemo(() => {
    return agents.filter((member) => {
      if (filterMode === 'ONLINE' && !onlineSet.has(member.id) && member.status !== 'ONLINE') return false;
      if (filterMode === 'MANAGERS' && !['ADMIN', 'SUPERVISOR'].includes(member.role)) return false;
      if (filterMode === 'AGENTS' && member.role !== 'AGENT') return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(q);
    });
  }, [agents, filterMode, searchQuery, onlineSet]);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 10) {
      setFeedback({ type: 'error', text: 'Enter name, valid email, and a temporary password of at least 10 characters.' });
      return;
    }

    setCreating(true);
    setFeedback(null);
    try {
      await apiFetch('/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          password,
        }),
      });
      setFeedback({ type: 'success', text: `${name.trim()} added to ${tenant?.name || 'your workspace'}.` });
      setName('');
      setEmail('');
      setPassword('');
      setRole('AGENT');
      await loadTeamData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateMember = async (memberId, updates) => {
    setFeedback(null);
    try {
      await apiFetch(`/api/agents/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      await loadTeamData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page-scroll-container" data-node-id="2:11">
      <div className="workspace-page-header" style={{ padding: '20px 0 18px 0' }}>
        <div className="page-header-text">
          <h1 className="page-header-title">Better together</h1>
          <p className="page-header-subtitle">
            Manage your people, their permissions, and the work in their queue.
          </p>
        </div>

        <span className="page-pill-badge neutral">
          {agents.filter((a) => a.isActive).length} of {maxSeats} seats used
        </span>
      </div>

      {feedback && (
        <div className={`tb-alert ${feedback.type}`} style={{ marginBottom: '16px' }}>
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      <div className="page-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Team members</div>
          <div className="kpi-value">{metrics.total}</div>
          <div className="kpi-subtext">{metrics.adminsCount} admins/supervisors · {metrics.regularCount} agents</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Available now</div>
          <div className="kpi-value">{metrics.availableCount}</div>
          <div className="kpi-subtext">Connected to respond live</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open conversations</div>
          <div className="kpi-value">{metrics.openConversations}</div>
          <div className="kpi-subtext">Assigned across active teammates</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open seats</div>
          <div className="kpi-value">{metrics.seatsRemaining}</div>
          <div className="kpi-subtext">Remaining on current plan</div>
        </div>
      </div>

      <div className="page-two-col">
        <div className="page-stack">
          <div className="page-card">
            <div className="page-card-header" style={{ flexWrap: 'wrap' }}>
              <h2 className="page-card-title">Your team</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  className="tb-select"
                  style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }}
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value)}
                >
                  <option value="ALL">All members</option>
                  <option value="ONLINE">Available now</option>
                  <option value="MANAGERS">Admins &amp; Supervisors</option>
                  <option value="AGENTS">Agents only</option>
                </select>
                <input
                  type="text"
                  className="tb-input"
                  style={{ width: '185px', padding: '6px 10px', fontSize: '12px' }}
                  placeholder="Search teammates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <p className="tb-hint">Loading team roster...</p>
            ) : (
              <div className="tb-table-wrap">
                <table className="tb-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Open</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((member) => {
                      const isLive = onlineSet.has(member.id) || member.status === 'ONLINE';
                      const canEditRole =
                        currentAgent?.role === 'ADMIN' ||
                        (currentAgent?.role === 'SUPERVISOR' && member.role !== 'ADMIN');

                      return (
                        <tr key={member.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 600 }}>{member.name}</span>
                              {member.id === currentAgent?.id && (
                                <span className="page-pill-badge neutral" style={{ fontSize: '10px', padding: '1px 6px' }}>
                                  You
                                </span>
                              )}
                            </div>
                            <div className="tb-hint">{member.email}</div>
                          </td>
                          <td>
                            <select
                              className="tb-select"
                              style={{ width: 'auto', padding: '4px 8px', fontSize: '11.5px' }}
                              value={member.role}
                              disabled={!canEditRole}
                              onChange={(e) => handleUpdateMember(member.id, { role: e.target.value })}
                            >
                              <option value="AGENT">Agent</option>
                              <option value="SUPERVISOR">Supervisor</option>
                              {(currentAgent?.role === 'ADMIN' || member.role === 'ADMIN') && (
                                <option value="ADMIN">Admin</option>
                              )}
                            </select>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 500, color: isLive ? 'var(--tb-primary-green)' : 'var(--tb-text-secondary)' }}>
                              ● {isLive ? 'Available' : 'Offline'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{member.activeChatCount || 0}</td>
                          <td>
                            {member.id !== currentAgent?.id && isManager && !(currentAgent?.role === 'SUPERVISOR' && member.role === 'ADMIN') ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 9px', fontSize: '11px' }}
                                onClick={() => handleUpdateMember(member.id, { isActive: !member.isActive })}
                              >
                                {member.isActive ? 'Deactivate' : 'Reactivate'}
                              </button>
                            ) : (
                              <span className="tb-hint">{member.isActive ? 'Active' : 'Disabled'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="page-card">
            <h3 className="page-card-title" style={{ marginBottom: '12px' }}>The right access for every role</h3>
            <div className="tb-table-wrap">
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    <th>Agent</th>
                    <th>Supervisor</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Reply, claim unassigned chats &amp; add internal notes</td>
                    <td><Check size={14} color="var(--tb-primary-green)" /></td>
                    <td><Check size={14} color="var(--tb-primary-green)" /></td>
                    <td><Check size={14} color="var(--tb-primary-green)" /></td>
                  </tr>
                  <tr>
                    <td>View all conversations &amp; reassign ownership</td>
                    <td>—</td>
                    <td><Check size={14} color="var(--tb-primary-green)" /></td>
                    <td><Check size={14} color="var(--tb-primary-green)" /></td>
                  </tr>
                  <tr>
                    <td>Manage campaigns, team seats &amp; WhatsApp settings</td>
                    <td>—</td>
                    <td>—</td>
                    <td><Check size={14} color="var(--tb-primary-green)" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="page-card">
          <h3 className="page-card-title">Make room for one more</h3>
          <p className="page-card-subtitle" style={{ marginBottom: '16px' }}>
            Add a teammate to {tenant?.name || 'your workspace'}.
          </p>

          <form onSubmit={handleInviteSubmit} className="page-stack" style={{ gap: '14px' }}>
            <div className="tb-field">
              <label className="tb-label">Full name</label>
              <input
                type="text"
                required
                className="tb-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jamie Lee"
              />
            </div>

            <div className="tb-field">
              <label className="tb-label">Email address</label>
              <input
                type="email"
                required
                className="tb-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jamie@company.com"
              />
            </div>

            <div className="tb-field">
              <label className="tb-label">Workspace role</label>
              <div className="role-selector-cards">
                <button
                  type="button"
                  className={`role-card-btn ${role === 'AGENT' ? 'active' : ''}`}
                  onClick={() => setRole('AGENT')}
                >
                  <div className="role-card-title">Agent</div>
                  <div className="role-card-desc">Handle assigned &amp; unassigned chats</div>
                </button>
                <button
                  type="button"
                  className={`role-card-btn ${role === 'SUPERVISOR' ? 'active' : ''}`}
                  onClick={() => setRole('SUPERVISOR')}
                >
                  <div className="role-card-title">Supervisor</div>
                  <div className="role-card-desc">Reassign queues &amp; view analytics</div>
                </button>
              </div>
            </div>

            <div className="tb-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="tb-label">Temporary password</label>
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generateTemporaryPassword());
                    setShowPassword(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--tb-primary-green)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={11} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
                  Generate
                </button>
              </div>
              <div className="auth-password-wrapper" style={{ paddingRight: '10px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={10}
                  className="auth-input-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 10 characters"
                />
                <button
                  type="button"
                  className="auth-show-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 14px' }}
              disabled={creating || currentAgent?.role !== 'ADMIN'}
            >
              {creating
                ? 'Creating account...'
                : currentAgent?.role !== 'ADMIN'
                  ? 'Only admins can invite members'
                  : 'Create teammate account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
