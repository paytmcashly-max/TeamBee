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

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '18px' };
  const statCard = (icon, label, value, sub) => (
    <div style={card}>
      <span style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
        {icon}
      </span>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>{label}</div>
      {sub && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
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
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-app)' }}>
      <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '26px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '23px', fontWeight: 800, color: '#fff' }}>
              {tenant?.name || 'Your workspace'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Welcome back, {agent?.name?.split(' ')[0] || 'there'} — here is your business on WhatsApp today.
            </p>
          </div>
          <button onClick={onOpenInbox} className="btn btn-primary" style={{ padding: '11px 18px', fontSize: '14px', gap: '8px' }}>
            <Inbox size={16} /> Open Inbox
          </button>
        </div>

        {tenant?.subscriptionStatus === 'TRIAL' && (
          <div style={{ ...card, borderColor: 'rgba(245, 158, 11, 0.45)', background: 'rgba(245, 158, 11, 0.07)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
            <Crown size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: '200px', fontSize: '13.5px', color: '#fde68a', lineHeight: 1.55 }}>
              <strong>Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left</strong> on the Pro plan.
              Pick a plan below before it ends so your team’s work never pauses.
            </div>
          </div>
        )}

        {loading ? (
          <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skel" style={{ height: '118px' }} />
            ))}
          </div>
        ) : data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
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
              <div style={{ ...card, marginTop: '16px' }}>
                <h2 style={{ fontSize: '15px', color: '#fff', marginBottom: '4px' }}>Get set up</h2>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Finish these steps to get full value from TeamBee.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {steps.map((s) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '9px' }}>
                      {s.done ? (
                        <CheckCircle2 size={18} style={{ color: 'var(--wa-primary)', flexShrink: 0 }} />
                      ) : (
                        <Circle size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                      <span style={{ flex: 1, fontSize: '13.5px', color: s.done ? 'var(--text-muted)' : '#e2e8f0', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
                      {!s.done && (
                        <button onClick={s.action} className="btn btn-secondary" style={{ padding: '6px 11px', fontSize: '12px', gap: '5px' }}>
                          {s.cta} <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...card, marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '4px' }}>
                <Sparkles size={17} style={{ color: 'var(--wa-primary)' }} />
                <h2 style={{ fontSize: '15px', color: '#fff' }}>Your plan — {tenant?.plan || data.subscription.plan}</h2>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                {tenant?.subscriptionStatus === 'TRIAL'
                  ? 'You are trialling Pro free. Choose a plan to continue after the trial.'
                  : 'Switch plans anytime — changes apply from the next billing cycle.'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {PLANS.map((p) => {
                  const current = (tenant?.plan || '') === p.key && tenant?.subscriptionStatus === 'ACTIVE';
                  return (
                    <div key={p.key} style={{ border: `1px solid ${current ? 'var(--wa-primary)' : 'var(--border-subtle)'}`, borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 8px' }}>{p.features[0]} · ₹{p.price.toLocaleString('en-IN')}/mo</div>
                      {current ? (
                        <span style={{ fontSize: '12px', color: 'var(--wa-primary)', fontWeight: 600 }}>Current plan</span>
                      ) : (
                        <button onClick={() => handleUpgrade(p.key)} disabled={upgrading === p.key} className="btn btn-secondary" style={{ padding: '7px 12px', fontSize: '12.5px' }}>
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
          <div style={{ ...card, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Dashboard data could not be loaded. Open the inbox — your chats are unaffected.
          </div>
        )}
      </div>
    </div>
  );
}
