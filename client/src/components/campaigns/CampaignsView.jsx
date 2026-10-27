import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  ArrowLeft,
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
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function CampaignsView({ onBack, onOpenCreateBroadcast }) {
  const { token } = useAuth();
  const toast = useToast();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'RUNNING'

  const loadBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/broadcasts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.success) {
        setBroadcasts(data.broadcasts || []);
      }
    } catch (err) {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBroadcasts();
  }, []);

  // Compute aggregate metrics
  const totalSent = broadcasts.reduce((acc, b) => acc + (b.sentCount || 0), 0);
  const totalDelivered = broadcasts.reduce((acc, b) => acc + (b.deliveredCount || 0), 0);
  const totalRead = broadcasts.reduce((acc, b) => acc + (b.readCount || 0), 0);
  const totalFailed = broadcasts.reduce((acc, b) => acc + (b.failedCount || 0), 0);

  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 98;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 84;

  const filteredBroadcasts = broadcasts.filter((b) => {
    if (filter === 'ALL') return true;
    return b.status === filter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-app)', overflowY: 'auto' }}>
      {/* Top Header */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--text-secondary)', padding: '6px' }}
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(37, 211, 102, 0.12)',
                  color: 'var(--wa-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Radio size={18} />
              </div>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                High-Speed Broadcast &amp; Campaign Hub
              </h1>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#0284c7',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                DoubleTick Scale
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 40px' }}>
              Bulk Meta-approved WhatsApp marketing with zero-lag delivery, read tracking, and smart segmenting
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCreateBroadcast}
          className="btn btn-primary btn-sm"
          style={{
            background: 'var(--wa-primary)',
            color: '#ffffff',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Plus size={15} />
          <span>Launch Campaign</span>
        </button>
      </div>

      <div style={{ padding: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
        {/* Metric Cards Banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '24px',
          }}
        >
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Send size={15} style={{ color: '#0284c7' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Total Broadcasts</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{broadcasts.length}</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>Active &amp; completed campaigns</div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Users size={15} style={{ color: 'var(--wa-primary)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Delivered Messages</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{totalDelivered.toLocaleString()}</div>
            <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '4px', fontWeight: '600' }}>
              {deliveryRate}% Delivery Rate
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCheck size={15} style={{ color: '#38bdf8' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Read Rate</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>{readRate}%</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {totalRead.toLocaleString()} read notifications
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <TrendingUp size={15} style={{ color: '#d97706' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Meta Throughput</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)' }}>Tier 250k</div>
            <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '4px', fontWeight: '600' }}>High Quality Rating</div>
          </div>
        </div>

        {/* Campaign List Header & Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'RUNNING', 'COMPLETED'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`btn btn-xs ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  borderRadius: '20px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  background: filter === f ? 'var(--wa-primary)' : 'var(--bg-surface)',
                  color: filter === f ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {f === 'ALL' ? 'All Campaigns' : f === 'RUNNING' ? 'Running' : 'Completed'}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filteredBroadcasts.length} campaigns
          </span>
        </div>

        {/* Campaign Cards */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
            Loading campaigns...
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-medium)',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <Radio size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
              No broadcast campaigns launched yet
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Broadcast approved Meta templates to segmented audiences (VIP, Leads, Customers) in bulk.
            </p>
            <button onClick={onOpenCreateBroadcast} className="btn btn-primary btn-sm">
              <Plus size={14} /> Create First Campaign
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredBroadcasts.map((b) => {
              const total = b.totalCount || 0;
              const delivered = b.deliveredCount || 0;
              const read = b.readCount || 0;
              const failed = b.failedCount || 0;
              const pct = total > 0 ? Math.min(100, Math.round((delivered / total) * 100)) : 0;

              return (
                <div
                  key={b.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                          {b.name}
                        </h3>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background:
                              b.status === 'COMPLETED'
                                ? 'rgba(37, 211, 102, 0.12)'
                                : b.status === 'RUNNING'
                                ? 'rgba(56, 189, 248, 0.12)'
                                : 'rgba(245, 158, 11, 0.12)',
                            color:
                              b.status === 'COMPLETED'
                                ? '#16a34a'
                                : b.status === 'RUNNING'
                                ? '#0284c7'
                                : '#d97706',
                          }}
                        >
                          {b.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Template: <strong style={{ color: 'var(--text-secondary)' }}>{b.template?.name || 'Approved WhatsApp Template'}</strong> • Created {new Date(b.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12.5px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Target: </span>
                        <strong>{total}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Delivered: </span>
                        <strong style={{ color: '#16a34a' }}>{delivered}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Read: </span>
                        <strong style={{ color: '#0284c7' }}>{read}</strong>
                      </div>
                      {failed > 0 && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Failed: </span>
                          <strong style={{ color: '#dc2626' }}>{failed}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ width: '100%', background: 'rgba(15, 23, 42, 0.08)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--wa-primary) 0%, #38bdf8 100%)',
                        transition: 'width 0.4s ease',
                      }}
                    />
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
