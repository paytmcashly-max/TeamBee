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
  const actionCard = (icon, title, text, onClick, adminOnly) => {
    if (adminOnly && !isAdmin) return null;
    const Icon = icon;
    return (
      <button key={title} type="button" onClick={onClick} className="action-card">
        <span className="stat-icon" style={{ width: '38px', height: '38px' }}>
          <Icon size={18} />
        </span>
        <span className="action-card-title">{title}</span>
        <span className="action-card-text">{text}</span>
      </button>
    );
  };

  return (
    <div className="page-scroll">
      <div className="page-wrap" style={{ maxWidth: '880px' }}>
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={15} /> Back to inbox
        </button>
        <h1 className="page-title" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <LifeBuoy size={22} style={{ color: 'var(--wa-primary)' }} /> Help &amp; Support
        </h1>
        <p className="t-body" style={{ marginTop: 'var(--space-2)' }}>
          The fastest route to every task, and answers to the questions every WhatsApp team asks.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
          {actionCard(Shield, 'Connect WhatsApp number', 'Link or check your Meta WhatsApp setup — the step that takes a workspace live.', onOpenSettings, true)}
          {actionCard(Sparkles, 'Create a template', 'Build a message template and submit it for Meta approval, without leaving TeamBee.', onOpenTemplates, false)}
          {actionCard(Megaphone, 'Send a broadcast', 'Open any conversation and use the broadcast button in the chat header — or start from the dashboard checklist.', onOpenDashboard, false)}
          {actionCard(Users, 'Invite your team', 'Add agents, set roles, and tune automation like round-robin assignment and office hours.', onOpenAgents, true)}
          {actionCard(LayoutDashboard, 'Plans, trial & billing', 'See your plan, trial days left and workspace numbers on the owner dashboard.', onOpenDashboard, false)}
        </div>

        <h2 className="t-h3" style={{ marginTop: 'var(--space-8)', marginBottom: 'var(--space-3)' }}>
          Frequently asked
        </h2>
        <div className="faq" style={{ marginTop: 0 }}>
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>

        <div className="card" style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="stat-icon" style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-full)', marginBottom: 0 }}>
            <MessageCircle size={20} />
          </span>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div className="action-card-title">Still stuck? Talk to support on WhatsApp</div>
            <div className="action-card-text">
              Fitting, for a WhatsApp product — message TeamBee support on WhatsApp and the team will pick it up from our own inbox.
            </div>
          </div>
          <a href={SUPPORT_WA_LINK} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Chat with support
          </a>
        </div>
      </div>
    </div>
  );
}
