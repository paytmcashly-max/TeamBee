import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Eye,
  CheckCheck,
  Send,
  Sparkles,
  BarChart3,
  TrendingUp,
  Zap,
  Target,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

function StatCard({ icon, label, value, sub, subColor, gradient, iconBg }) {
  return (
    <div className="dt-stat-card">
      <div className="dt-stat-icon" style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="dt-stat-body">
        <div className="dt-stat-label">{label}</div>
        <div className="dt-stat-value">{value}</div>
        {sub && (
          <div className="dt-stat-sub" style={{ color: subColor || 'var(--text-muted)' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignsView({ onBack, onOpenCreateBroadcast }) {
  const { token } = useAuth();
  const toast = useToast();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const loadBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/broadcasts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) setBroadcasts(data.broadcasts || []);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBroadcasts(); }, []);

  const totalSent = broadcasts.reduce((a, b) => a + (b.sentCount || 0), 0);
  const totalDelivered = broadcasts.reduce((a, b) => a + (b.deliveredCount || 0), 0);
  const totalRead = broadcasts.reduce((a, b) => a + (b.readCount || 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 98;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 84;

  const filtered = broadcasts.filter(b => filter === 'ALL' || b.status === filter);

  const statusConfig = {
    COMPLETED: { bg: 'rgba(37, 211, 102, 0.12)', color: '#16a34a', dot: '#22c55e' },
    RUNNING:   { bg: 'rgba(56, 189, 248, 0.12)',  color: '#0284c7', dot: '#38bdf8' },
    PENDING:   { bg: 'rgba(245, 158, 11, 0.12)',  color: '#d97706', dot: '#f59e0b' },
    FAILED:    { bg: 'rgba(239, 68, 68, 0.12)',   color: '#dc2626', dot: '#ef4444' },
  };

  return (
    <div className="dt-page">
      {/* Page Header */}
      <div className="dt-page-header">
        <div className="dt-page-header-left">
          <div className="dt-page-icon" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#0284c7' }}>
            <Radio size={18} />
          </div>
          <div>
            <h1 className="dt-page-title">Broadcast Campaigns</h1>
            <p className="dt-page-desc">
              Meta-approved WhatsApp marketing at scale — track delivery, reads &amp; ROI
            </p>
          </div>
        </div>
        <div className="dt-page-header-right">
          <button onClick={loadBroadcasts} className="dt-btn dt-btn-ghost dt-btn-sm" title="Refresh">
            <Activity size={15} />
          </button>
          <button
            onClick={onOpenCreateBroadcast}
            className="dt-btn dt-btn-primary dt-btn-sm"
          >
            <Plus size={15} />
            <span>Launch Campaign</span>
          </button>
        </div>
      </div>

      {/* Page Body */}
      <div className="dt-page-body">
        {/* Stats Row */}
        <div className="dt-stats-grid">
          <StatCard
            icon={<Send size={18} />}
            label="Total Campaigns"
            value={broadcasts.length}
            sub="All time broadcasts"
            iconBg="rgba(56, 189, 248, 0.12)"
          />
          <StatCard
            icon={<Users size={18} style={{ color: '#0284c7' }} />}
            label="Messages Sent"
            value={totalSent.toLocaleString()}
            sub={`${deliveryRate}% delivery rate`}
            subColor="#16a34a"
            iconBg="rgba(37, 211, 102, 0.12)"
          />
          <StatCard
            icon={<CheckCheck size={18} style={{ color: '#38bdf8' }} />}
            label="Read Rate"
            value={`${readRate}%`}
            sub={`${totalRead.toLocaleString()} read`}
            subColor="#0284c7"
            iconBg="rgba(56, 189, 248, 0.12)"
          />
          <StatCard
            icon={<Zap size={18} style={{ color: '#d97706' }} />}
            label="Meta Tier"
            value="250k / day"
            sub="High Quality Rating ✓"
            subColor="#16a34a"
            iconBg="rgba(245, 158, 11, 0.10)"
          />
        </div>

        {/* Filter Bar */}
        <div className="dt-section-header">
          <div className="dt-filter-tabs">
            {['ALL', 'RUNNING', 'COMPLETED'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`dt-filter-tab ${filter === f ? 'dt-filter-tab-active' : ''}`}
              >
                {f === 'ALL' ? 'All' : f === 'RUNNING' ? '● Running' : '✓ Completed'}
              </button>
            ))}
          </div>
          <span className="dt-section-count">{filtered.length} campaign{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Campaign List */}
        {loading ? (
          <div className="dt-empty-state">
            <div className="dt-spinner" />
            <p>Loading campaigns…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dt-empty-state dt-empty-dashed">
            <div className="dt-empty-icon" style={{ background: 'rgba(56, 189, 248, 0.10)', color: '#0284c7' }}>
              <Radio size={28} />
            </div>
            <h3>No campaigns yet</h3>
            <p>Launch your first broadcast to segmented audiences — VIP customers, leads, or everyone.</p>
            <button onClick={onOpenCreateBroadcast} className="dt-btn dt-btn-primary dt-btn-sm">
              <Plus size={14} /> Create First Campaign
            </button>
          </div>
        ) : (
          <div className="dt-list">
            {filtered.map(b => {
              const total = b.totalCount || 0;
              const delivered = b.deliveredCount || 0;
              const read = b.readCount || 0;
              const failed = b.failedCount || 0;
              const pct = total > 0 ? Math.min(100, Math.round((delivered / total) * 100)) : 0;
              const sc = statusConfig[b.status] || statusConfig.PENDING;

              return (
                <div key={b.id} className="dt-campaign-card">
                  <div className="dt-campaign-card-top">
                    <div className="dt-campaign-card-meta">
                      <div className="dt-campaign-card-name-row">
                        <h3 className="dt-campaign-name">{b.name}</h3>
                        <span
                          className="dt-status-badge"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          <span className="dt-status-dot" style={{ background: sc.dot }} />
                          {b.status}
                        </span>
                      </div>
                      <div className="dt-campaign-sub">
                        <span>Template: <strong>{b.template?.name || 'WhatsApp Template'}</strong></span>
                        <span className="dt-dot-sep">·</span>
                        <span>{new Date(b.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <div className="dt-campaign-stats">
                      <div className="dt-mini-stat">
                        <span className="dt-mini-stat-label">Target</span>
                        <span className="dt-mini-stat-value">{total.toLocaleString()}</span>
                      </div>
                      <div className="dt-mini-stat">
                        <span className="dt-mini-stat-label">Delivered</span>
                        <span className="dt-mini-stat-value" style={{ color: '#16a34a' }}>{delivered.toLocaleString()}</span>
                      </div>
                      <div className="dt-mini-stat">
                        <span className="dt-mini-stat-label">Read</span>
                        <span className="dt-mini-stat-value" style={{ color: '#0284c7' }}>{read.toLocaleString()}</span>
                      </div>
                      {failed > 0 && (
                        <div className="dt-mini-stat">
                          <span className="dt-mini-stat-label">Failed</span>
                          <span className="dt-mini-stat-value" style={{ color: '#dc2626' }}>{failed.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="dt-progress-track">
                    <div className="dt-progress-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="dt-progress-label">
                    <span>{pct}% delivered</span>
                    {total > 0 && <span>{total.toLocaleString()} recipients</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
