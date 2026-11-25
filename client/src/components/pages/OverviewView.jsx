import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/apiClient';

function formatDelta(today, yesterday) {
  if (yesterday === undefined || yesterday === null || (yesterday === 0 && today === 0)) return 'No change vs yesterday';
  if (yesterday === 0) return 'New activity today';
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  if (pct === 0) return 'Same as yesterday';
  return `${pct > 0 ? `+${pct}%` : `${pct}%`} vs yesterday`;
}

export default function OverviewView({ onNavigateView }) {
  const { tenant } = useAuth();
  const [overview, setOverview] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch('/api/analytics/overview'),
      apiFetch('/api/billing/status').catch(() => null),
    ])
      .then(([analyticsData, billingData]) => {
        if (!active) return;
        setOverview(analyticsData.stats || analyticsData);
        setBilling(billingData);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = overview || {};
  const checklist = [
    {
      label: 'Connect WhatsApp Business API channel',
      done: Boolean(tenant?.hasMetaConfigured),
      actionLabel: 'Configure channel',
      view: 'settings',
    },
    {
      label: 'Sync or create approved Meta templates',
      done: (stats.templatesApproved || 0) > 0,
      actionLabel: 'Open templates',
      view: 'templates',
    },
    {
      label: 'Add team members & assign roles',
      done: (stats.agentsTotal || 0) > 1,
      actionLabel: 'Manage team',
      view: 'team',
    },
    {
      label: 'Launch your first broadcast campaign',
      done: (stats.broadcastsTotal || 0) > 0,
      actionLabel: 'Go to broadcasts',
      view: 'broadcasts',
    },
  ];

  return (
    <div className="page-scroll-container">
      <div className="workspace-page-header" style={{ padding: '20px 0 18px 0' }}>
        <div className="page-header-text">
          <h1 className="page-header-title">Workspace overview</h1>
          <p className="page-header-subtitle">
            Today’s customer activity, response throughput, and setup readiness for {tenant?.name || 'your team'}.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => onNavigateView?.('inbox')}>
          <span>Open Inbox</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {error && <div className="tb-alert error" style={{ marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <p className="tb-hint">Loading analytics...</p>
      ) : (
        <>
          <div className="page-kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">New chats today</div>
              <div className="kpi-value">{stats.chatsToday ?? 0}</div>
              <div className="kpi-subtext">{formatDelta(stats.chatsToday, stats.chatsYesterday)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Open queue</div>
              <div className="kpi-value">{stats.openChats ?? 0}</div>
              <div className="kpi-subtext">{stats.unassignedChats ?? 0} unassigned waiting</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Resolved today</div>
              <div className="kpi-value">{stats.resolvedToday ?? 0}</div>
              <div className="kpi-subtext">{formatDelta(stats.resolvedToday, stats.resolvedYesterday)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Messages today</div>
              <div className="kpi-value">{(stats.messagesInToday ?? 0) + (stats.messagesOutToday ?? 0)}</div>
              <div className="kpi-subtext">
                {stats.messagesInToday ?? 0} inbound · {stats.messagesOutToday ?? 0} outbound
              </div>
            </div>
          </div>

          <div className="page-two-col">
            <div className="page-card">
              <div className="page-card-header">
                <div>
                  <h2 className="page-card-title">Launch checklist</h2>
                  <p className="page-card-subtitle">Core steps for reliable multi-agent WhatsApp operations</p>
                </div>
              </div>

              <div className="page-stack" style={{ gap: '10px' }}>
                {checklist.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--tb-light-bg)',
                      borderRadius: '8px',
                      border: '1px solid var(--tb-border-light)',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                      {item.done ? (
                        <CheckCircle2 size={16} color="var(--tb-primary-green)" />
                      ) : (
                        <Circle size={16} color="var(--tb-text-secondary)" />
                      )}
                      <span>{item.label}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                      onClick={() => onNavigateView?.(item.view)}
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="page-card">
              <h2 className="page-card-title" style={{ marginBottom: '6px' }}>Subscription &amp; throughput</h2>
              <p className="page-card-subtitle" style={{ marginBottom: '14px' }}>
                Plan: {billing?.plan || tenant?.plan || 'PRO'} · Status: {billing?.subscriptionStatus || 'ACTIVE'}
              </p>
              <div className="details-kv-table">
                <div className="details-kv-row">
                  <span className="details-k">Online teammates</span>
                  <span className="details-v">{stats.agentsOnline ?? 0} / {stats.agentsTotal ?? 0}</span>
                </div>
                <div className="details-kv-row">
                  <span className="details-k">Approved templates</span>
                  <span className="details-v">{stats.templatesApproved ?? 0}</span>
                </div>
                <div className="details-kv-row">
                  <span className="details-k">Total outbound messages</span>
                  <span className="details-v">{stats.outboundTotal ?? 0}</span>
                </div>
                <div className="details-kv-row">
                  <span className="details-k">Campaigns launched</span>
                  <span className="details-v">{stats.broadcastsTotal ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
