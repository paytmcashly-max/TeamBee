import React from 'react';
import {
  ArrowLeft,
  Shield,
  Sparkles,
  Megaphone,
  Users,
  LayoutDashboard,
  MessageCircle,
  LifeBuoy,
} from 'lucide-react';

// In-app help: the answers and routes a user needs without leaving the
// product — task cards that open the right tool, the questions every
// WhatsApp inbox team asks, and a real support route (the product's
// own WhatsApp number — fitting for a WhatsApp product).
const SUPPORT_WA_LINK = 'https://wa.me/919122279441?text=Hi%20TeamBee%20support%2C%20I%20need%20help%20with%20my%20workspace.';

const FAQS = [
  {
    q: 'Why can’t I send a normal message to this customer?',
    a: 'WhatsApp allows free-form replies only within 24 hours of the customer’s last message (the service window). After that, send a Meta-approved template — it reopens the conversation, and you can chat freely again once the customer replies.',
  },
  {
    q: 'How long does template approval take?',
    a: 'Meta reviews every template. Many are approved within minutes; some take up to 24 hours. Keep the language clear, avoid spammy wording, and include an example for every {{variable}} — the in-app template form checks these for you before submitting.',
  },
  {
    q: 'How many broadcast messages can I send?',
    a: 'Your reach depends on Meta’s messaging tier for your number, which grows with your quality rating and business verification — new numbers start lower and rise as customers engage positively. TeamBee shows per-customer delivery status and retries failures automatically.',
  },
  {
    q: 'What is the difference between Admin, Supervisor and Agent?',
    a: 'Admins manage the workspace: team, settings, templates, broadcasts and billing. Supervisors can oversee chats and the team’s work without changing workspace settings. Agents reply to the chats assigned to them and use quick replies, tags and notes.',
  },
  {
    q: 'What happens when my trial ends?',
    a: 'Your workspace pauses — nothing is deleted. Pick a plan from the owner dashboard to resume exactly where you left off; your data, templates and team stay intact.',
  },
  {
    q: 'Is our customer data private?',
    a: 'Yes. Every workspace’s data is isolated at the database level, connections are encrypted, and we never sell data or use your conversations for advertising. You can read the full Privacy Policy on the public site.',
  },
];

export default function HelpView({ onBack, onOpenDashboard, onOpenTemplates, onOpenAgents, onOpenSettings, isAdmin }) {
  const card = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '14px',
    padding: '18px',
    textAlign: 'left',
    width: '100%',
  };
  const actionCard = (icon, title, text, onClick, adminOnly) => {
    if (adminOnly && !isAdmin) return null;
    const Icon = icon;
    return (
      <button key={title} type="button" onClick={onClick} style={{ ...card, cursor: onClick ? 'pointer' : 'default' }}>
        <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
          <Icon size={18} />
        </span>
        <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 700, color: '#fff' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '4px' }}>{text}</span>
      </button>
    );
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg-app)' }}>
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '22px 18px 50px' }}>
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '7px 11px', fontSize: '13px', gap: '6px', marginBottom: '14px' }}>
          <ArrowLeft size={15} /> Back to inbox
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '23px', fontWeight: 800, color: '#fff', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <LifeBuoy size={22} style={{ color: 'var(--wa-primary)' }} /> Help &amp; Support
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.6 }}>
          The fastest route to every task, and answers to the questions every WhatsApp team asks.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginTop: '22px' }}>
          {actionCard(Shield, 'Connect WhatsApp number', 'Link or check your Meta WhatsApp setup — the step that takes a workspace live.', onOpenSettings, true)}
          {actionCard(Sparkles, 'Create a template', 'Build a message template and submit it for Meta approval, without leaving TeamBee.', onOpenTemplates, false)}
          {actionCard(Megaphone, 'Send a broadcast', 'Open any conversation and use the broadcast button in the chat header — or start from the dashboard checklist.', onOpenDashboard, false)}
          {actionCard(Users, 'Invite your team', 'Add agents, set roles, and tune automation like round-robin assignment and office hours.', onOpenAgents, true)}
          {actionCard(LayoutDashboard, 'Plans, trial & billing', 'See your plan, trial days left and workspace numbers on the owner dashboard.', onOpenDashboard, false)}
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 800, color: '#fff', marginTop: '34px', marginBottom: '12px' }}>
          Frequently asked
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {FAQS.map((f) => (
            <details key={f.q} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '13px 15px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#fff' }}>{f.q}</summary>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: '7px' }}>{f.a}</p>
            </details>
          ))}
        </div>

        <div style={{ ...card, marginTop: '26px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MessageCircle size={20} />
          </span>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#fff' }}>Still stuck? Talk to support on WhatsApp</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.55 }}>
              Fitting, for a WhatsApp product — message TeamBee support on WhatsApp and the team will pick it up from our own inbox.
            </div>
          </div>
          <a href={SUPPORT_WA_LINK} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ padding: '10px 16px', fontSize: '13.5px', textDecoration: 'none' }}>
            Chat with support
          </a>
        </div>
      </div>
    </div>
  );
}
