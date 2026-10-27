import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Inbox,
  UserX,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Megaphone,
  Circle,
  ArrowRight,
  Sparkles,
  Crown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PLANS } from '../../data/plans';

// The owner's home screen. Agents live in the inbox; the person who
// PAYS for TeamBee opens the product here: today's pulse, plan/trial
// state, and the setup checklist that walks a new workspace to value.
export default function DashboardView({ onOpenInbox, onOpenSettings, onOpenTemplates, onOpenBroadcasts, onOpenAgents }) {
  const { token, agent, tenant } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/analytics/overview', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!cancelled && json.success) setData(json);
        else if (!cancelled) toast.error(json.error || 'Failed to load dashboard');
      } catch {
        if (!cancelled) toast.error('Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleUpgrade = async (planKey) => {
    setUpgrading(planKey);
    try {
      const res = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.info(json.error || 'Upgrade is not available yet.');
        return;
      }
      toast.info('Checkout is being prepared — this step completes once payment keys are live.');
    } catch {
      toast.error('Could not start the upgrade. Please try again.');
    } finally {
      setUpgrading('');
    }
  };

  const statCard = (icon, label, value, sub) => (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );

  const trialDaysLeft =
    tenant?.subscriptionStatus === 'TRIAL' && tenant?.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000))
      : null;

  const steps = data
    ? [
        { done: data.checklist.hasWhatsApp, label: 'Connect your WhatsApp number', cta: 'Connect', action: onOpenSettings },
        { done: data.checklist.hasCustomTemplate, label: 'Create your first template', cta: 'Create', action: onOpenTemplates },
        { done: data.checklist.teamInvited, label: 'Invite your team', cta: 'Invite', action: onOpenAgents },
        { done: data.checklist.hasOutbound, label: 'Send your first reply', cta: 'Open inbox', action: onOpenInbox },
        { done: data.checklist.hasBroadcast, label: 'Send your first broadcast', cta: 'Broadcast', action: onOpenBroadcasts },
      ]
    : [];
  const allDone = steps.length > 0 && steps.every((s) => s.done);

  return (
    <div className="page-scroll">
      <div className="page-wrap">
        <div className="page-head">
          <div className="page-head-main">
            <h1 className="page-title">{tenant?.name || 'Your workspace'}</h1>
            <p className="page-sub">
              Welcome back, {agent?.name?.split(' ')[0] || 'there'} — here is your business on WhatsApp today.
            </p>
          </div>
          <button onClick={onOpenInbox} className="btn btn-primary btn-lg">
            <Inbox size={16} /> Open Inbox
          </button>
        </div>

        {tenant?.subscriptionStatus === 'TRIAL' && (
          <div className="banner-warn">
            <Crown size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: '200px' }}>
              <strong>Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left</strong> on the Pro plan.
              Pick a plan below before it ends so your team’s work never pauses.
            </div>
          </div>
        )}

        {loading ? (
          <div aria-hidden="true" className="stat-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skel" style={{ height: '118px' }} />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="stat-grid">
              {statCard(<MessageSquare size={17} />, 'Chats started today', data.stats.chatsToday)}
              {statCard(<Inbox size={17} />, 'Open chats', data.stats.openChats, `${data.stats.unassignedChats} waiting for an owner`)}
              {statCard(<UserX size={17} />, 'Unassigned', data.stats.unassignedChats)}
              {statCard(<CheckCircle2 size={17} />, 'Resolved today', data.stats.resolvedToday)}
              {statCard(<ArrowDownLeft size={17} />, 'Messages received today', data.stats.messagesInToday)}
              {statCard(<ArrowUpRight size={17} />, 'Replies sent today', data.stats.messagesOutToday)}
              {statCard(<Users size={17} />, 'Team online', `${data.stats.agentsOnline}/${data.stats.agentsTotal}`)}
              {statCard(<Megaphone size={17} />, 'Broadcasts sent', data.stats.broadcastsTotal)}
            </div>

            {!allDone && (
              <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                <h2 className="card-title">Get set up</h2>
                <p className="t-small" style={{ marginBottom: 'var(--space-3)' }}>Finish these steps to get full value from TeamBee.</p>
                <div className="checklist">
                  {steps.map((s) => (
                    <div key={s.label} className="checklist-row">
                      {s.done ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--wa-primary)', flexShrink: 0 }} />
                      ) : (
                        <Circle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                      <span className={`checklist-label${s.done ? ' done' : ''}`}>{s.label}</span>
                      {!s.done && (
                        <button onClick={s.action} className="btn btn-secondary btn-sm">
                          {s.cta} <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card" style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <Sparkles size={17} style={{ color: 'var(--wa-primary)' }} />
                <h2 className="card-title" style={{ marginBottom: 0 }}>Your plan — {tenant?.plan || data.subscription.plan}</h2>
              </div>
              <p className="t-small" style={{ marginBottom: 'var(--space-4)' }}>
                {tenant?.subscriptionStatus === 'TRIAL'
                  ? 'You are trialling Pro free. Choose a plan to continue after the trial.'
                  : 'Switch plans anytime — changes apply from the next billing cycle.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                {PLANS.map((p) => {
                  const current = (tenant?.plan || '') === p.key && tenant?.subscriptionStatus === 'ACTIVE';
                  return (
                    <div key={p.key} className={`plan-mini${current ? ' current' : ''}`}>
                      <div className="plan-mini-name">{p.name}</div>
                      <div className="plan-mini-meta">{p.features[0]} · ₹{p.price.toLocaleString('en-IN')}/mo</div>
                      {current ? (
                        <span className="t-small" style={{ color: 'var(--wa-primary)', fontWeight: 600 }}>Current plan</span>
                      ) : (
                        <button onClick={() => handleUpgrade(p.key)} disabled={upgrading === p.key} className="btn btn-secondary btn-sm">
                          {upgrading === p.key ? 'Starting…' : `Choose ${p.name}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="card t-body" style={{ textAlign: 'center' }}>
            Dashboard data could not be loaded. Open the inbox — your chats are unaffected.
          </div>
        )}
      </div>
    </div>
  );
}
