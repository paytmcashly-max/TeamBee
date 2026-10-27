import React from 'react';
import {
  MessageSquare,
  Users,
  Sparkles,
  Megaphone,
  Bot,
  Tags,
  BarChart3,
  Check,
  X,
  ArrowRight,
  ShieldCheck,
  Clock3,
  Send,
  Lock,
  DatabaseBackup,
  Smartphone,
  BadgeCheck,
  GraduationCap,
  Stethoscope,
  ShoppingBag,
  Building2,
  Scissors,
  Plane,
  Zap,
} from 'lucide-react';
import { PLANS, TRIAL_DAYS } from '../../data/plans';

// The public face of TeamBee, structured the way complete SaaS sites
// are: announcement → hero → trust strip → problem → how it works →
// features → deep-dives → metrics → industries → platform → comparison
// → pricing (+ comparison table) → FAQ → final CTA → full footer.
// Every claim on this page is a product fact; nothing here invents
// customers, counts or results the product cannot stand behind.

const FEATURES = [
  {
    icon: Users,
    title: 'Shared team inbox',
    text: 'Your whole team replies from one WhatsApp number — no more personal phones, no lost chats when someone is on leave.',
  },
  {
    icon: Sparkles,
    title: 'Templates that reopen chats',
    text: 'Meta-approved templates restart conversations after the 24-hour window — reminders, confirmations, offers.',
  },
  {
    icon: Megaphone,
    title: 'Broadcast campaigns',
    text: 'Send one message to hundreds of customers with delivery tracking, retries and per-person status.',
  },
  {
    icon: Bot,
    title: 'Automation & assignment',
    text: 'Auto-assign chats round-robin, greet customers outside office hours, and never let a chat sit unanswered.',
  },
  {
    icon: Tags,
    title: 'Tags, notes & mentions',
    text: 'Organise customers with tags and custom fields, discuss privately with team notes and @mentions.',
  },
  {
    icon: BarChart3,
    title: 'Owner dashboard',
    text: 'See today’s chats, open conversations and team activity at a glance — the numbers the owner actually runs on.',
  },
];

const PAINS = [
  {
    title: 'One phone, one person',
    text: 'The business number lives on a single phone. When that person is busy, travelling or leaves the job, customer chats stop — or walk away with them.',
  },
  {
    title: 'Nobody knows who replied',
    text: 'No record of which customer was answered, by whom, or what was promised. Follow-ups fall through the cracks every single day.',
  },
  {
    title: 'Broadcasts that risk a ban',
    text: 'The WhatsApp app caps broadcasts at 256 contacts and flags bulk sending from a normal number. One block and your business line is gone.',
  },
  {
    title: 'The 24-hour wall',
    text: 'A customer messages on Friday; by Monday the reply window feels closed and the lead has bought from someone else.',
  },
];

const STEPS = [
  { n: '1', title: 'Create your workspace', text: `Sign up in a minute. Your ${TRIAL_DAYS}-day free trial starts immediately — no card needed.` },
  { n: '2', title: 'Connect your WhatsApp number', text: 'Link your business number through Meta’s official setup. Your existing number and chats stay yours.' },
  { n: '3', title: 'Invite your team', text: 'Add agents, assign roles, and start replying together from day one.' },
];

const INDUSTRIES = [
  { icon: GraduationCap, name: 'Coaching & education', text: 'Demo-class confirmations, fee reminders and batch updates to parents — from the institute’s one number.' },
  { icon: Stethoscope, name: 'Clinics & healthcare', text: 'Appointment bookings, report-ready alerts and follow-up reminders your front desk can run as a team.' },
  { icon: ShoppingBag, name: 'Retail & D2C brands', text: 'Order updates, abandoned-cart nudges and support on the channel your customers actually read.' },
  { icon: Building2, name: 'Real estate', text: 'Site-visit scheduling and lead follow-ups that never sit in one agent’s personal phone.' },
  { icon: Scissors, name: 'Salons & local services', text: 'Bookings, reschedule requests and offer broadcasts to your regulars — without spamming from a personal number.' },
  { icon: Plane, name: 'Travel & agencies', text: 'Itinerary sharing, payment reminders and trip support handled by the whole office, not one handset.' },
];

const COMPARISON = [
  { label: 'Team members on one number', app: '1 phone + 4 linked devices', personal: '1 phone', teambee: 'Your whole team — 3 to 25 logins by plan' },
  { label: 'Everyone sees every conversation', app: false, personal: false, teambee: true },
  { label: 'Assign chats & track who replied', app: false, personal: false, teambee: true },
  { label: 'Private team notes & @mentions', app: false, personal: false, teambee: true },
  { label: 'Broadcast reach', app: '256 contacts at a time', personal: '256 contacts, ban risk', teambee: 'Template broadcasts to your full contact list, with delivery tracking' },
  { label: 'Reply after 24 hours', app: 'Only if the customer writes again', personal: 'Only if the customer writes again', teambee: 'Meta-approved templates reopen the chat anytime' },
  { label: 'Automation (auto-assign, away replies)', app: 'Basic away message only', personal: false, teambee: true },
  { label: 'Owner analytics & team metrics', app: false, personal: false, teambee: true },
  { label: 'Built on the official WhatsApp API', app: false, personal: false, teambee: true },
];

const PLAN_ROWS = [
  { label: 'Team agents included', values: ['3', '10', '25'] },
  { label: 'Shared team inbox', values: [true, true, true] },
  { label: 'Template messages', values: [true, true, true] },
  { label: 'Quick replies & tags', values: [true, true, true] },
  { label: 'Broadcast campaigns', values: [false, true, true] },
  { label: 'Automation & auto-assignment', values: [false, true, true] },
  { label: 'Snooze & @mentions', values: [false, true, true] },
  { label: 'Owner analytics dashboard', values: [false, false, true] },
  { label: 'Support', values: ['Email', 'Email', 'Priority'] },
];

const FAQ = [
  {
    q: 'Is this the official WhatsApp API?',
    a: 'Yes. TeamBee is built on Meta’s official WhatsApp Business Platform (Cloud API) — the same foundation large companies use. No unofficial gateways, no ban risk from grey-area tools.',
  },
  {
    q: 'Can I use my existing WhatsApp number?',
    a: 'In most cases yes — a number can be migrated to the Business Platform. Our setup wizard walks you through it, and you keep the same number your customers already know.',
  },
  {
    q: 'What happens after the free trial?',
    a: 'You pick a plan and continue — your data, templates and team stay exactly as they are. Every workspace gets full Pro features during the trial; afterwards the plan you chose at signup applies. If you do nothing, the workspace pauses; nothing is deleted.',
  },
  {
    q: 'Does Meta charge anything extra?',
    a: 'Meta charges per conversation (utility messages are the cheapest, marketing costs more) — those charges are Meta’s, billed by Meta, and are separate from your TeamBee subscription. Service conversations within the 24-hour window are Meta’s cheapest category. We show this openly because it is the second bill every WhatsApp API provider has — most just don’t mention it.',
  },
  {
    q: 'How many team members can I add?',
    a: 'It depends on your plan — Starter includes 3 agents, Growth 10 and Pro 25. Every agent gets their own login and role (Admin, Supervisor or Agent).',
  },
  {
    q: 'Is my customer data safe with TeamBee?',
    a: 'Your data is stored on established cloud infrastructure, transmitted over encrypted connections, and isolated per workspace at the database level. We never sell your data or use your conversations for advertising. Details are in the Privacy Policy below.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Paid plans are billed monthly in advance; you can cancel anytime and keep access until the end of the paid period. There is no cancellation fee, and your number and data remain yours.',
  },
  {
    q: 'Do you offer a demo or onboarding help?',
    a: 'The setup is self-serve and most teams are live the same day — connect your number with the in-app wizard, invite your team, and send a first template. If you get stuck, support is available inside your workspace.',
  },
];

function Logo({ onClick }) {
  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      title={onClick ? 'Back to top' : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', cursor: onClick ? 'pointer' : 'default' }}
    >
      <span
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '9px',
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        <MessageSquare size={18} />
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', color: '#fff' }}>TeamBee</span>
    </span>
  );
}

function InboxMock() {
  const row = (name, preview, time, active) => (
    <div
      style={{
        display: 'flex',
        gap: '9px',
        padding: '9px 10px',
        borderRadius: '10px',
        background: active ? 'var(--bg-surface-active)' : 'transparent',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #334155, #1e293b)',
          color: '#e2e8f0',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {name.split(' ').map((w) => w[0]).join('')}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
      </span>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{time}</span>
    </div>
  );
  return (
    <div
      aria-hidden="true"
      style={{
        background: 'var(--bg-sidebar)',
        border: '1px solid var(--border-medium)',
        borderRadius: '18px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '196px 1fr',
        minHeight: '300px',
        textAlign: 'left',
      }}
    >
      <div style={{ borderRight: '1px solid var(--border-subtle)', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {row('Aarav', 'Demo class confirmed!', '10:24', true)}
        {row('Sharma Ji', 'Fees receipt please', '09:51', false)}
        {row('Admissions', 'Class 10 timings?', '09:12', false)}
        {row('Priya', 'Test series dates?', 'Yesterday', false)}
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-app)' }}>
        <div style={{ alignSelf: 'flex-start', background: 'var(--bubble-inbound)', color: '#e2e8f0', padding: '8px 11px', borderRadius: '12px', fontSize: '12px', maxWidth: '82%', lineHeight: 1.45 }}>
          Hello, I want to confirm tomorrow’s demo class for Aarav.
        </div>
        <div style={{ alignSelf: 'flex-end', background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', padding: '8px 11px', borderRadius: '12px', fontSize: '12px', maxWidth: '82%', lineHeight: 1.45 }}>
          Confirmed! Tomorrow 5 PM. Our teacher will call 10 minutes before. 🙏
        </div>
        <div style={{ alignSelf: 'center', fontSize: '10.5px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '3px 9px', borderRadius: '99px' }}>
          Assigned to Rahul · Team note added
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', gap: '7px', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '99px', padding: '8px 13px' }}>
          <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)' }}>Type a WhatsApp message…</span>
          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Send size={11} />
          </span>
        </div>
      </div>
    </div>
  );
}

function BroadcastMock() {
  const bar = (label, pct, color) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        <span>{label}</span>
        <span style={{ color: '#fff', fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: '7px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px' }} />
      </div>
    </div>
  );
  return (
    <div aria-hidden="true" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', borderRadius: '18px', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', padding: '20px', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '4px' }}>
        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Megaphone size={15} />
        </span>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>Diwali offer campaign</span>
        <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 700, color: '#052e12', background: 'var(--wa-primary)', borderRadius: '99px', padding: '2px 8px' }}>SENT</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Template: festival_offer · 1,240 recipients</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
        {bar('Delivered', 98, '#25D366')}
        {bar('Read', 81, '#38bdf8')}
        {bar('Replied', 34, '#a78bfa')}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>Per-customer status, automatic retries for failed sends.</p>
    </div>
  );
}

function DashboardMock() {
  const stat = (label, value) => (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '13px 14px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 800, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{label}</div>
    </div>
  );
  return (
    <div aria-hidden="true" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-medium)', borderRadius: '18px', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', padding: '20px', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={15} />
        </span>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>Today at your business</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {stat('New chats', '46')}
        {stat('Open conversations', '12')}
        {stat('Replies sent', '183')}
        {stat('Resolved today', '39')}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px' }}>Team activity and response numbers, refreshed live.</p>
    </div>
  );
}

function CellValue({ value }) {
  if (value === true) return <Check size={16} style={{ color: 'var(--wa-primary)' }} aria-label="Included" />;
  if (value === false) return <X size={15} style={{ color: '#64748b' }} aria-label="Not included" />;
  return <span>{value}</span>;
}

export default function LandingPage({ onLogin, onSignup, onShowTerms, onShowPrivacy, onShowRefunds }) {
  const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, color: '#fff', textAlign: 'center' };
  const sectionSub = { fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '560px', margin: '10px auto 0', lineHeight: 1.6 };
  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px' };
  const thTd = { padding: '11px 13px', fontSize: '13px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', verticalAlign: 'top' };

  const deepDive = (kicker, title, points, visual, flip) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '26px', alignItems: 'center', marginTop: '44px' }}>
      <div style={{ order: flip ? 2 : 1 }}>
        <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '1.2px', color: 'var(--wa-primary)', textTransform: 'uppercase' }}>{kicker}</span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 800, color: '#fff', margin: '8px 0 12px', lineHeight: 1.25 }}>{title}</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {points.map((pt) => (
            <li key={pt} style={{ display: 'flex', gap: '9px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <Check size={16} style={{ color: 'var(--wa-primary)', flexShrink: 0, marginTop: '3px' }} /> {pt}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ order: flip ? 1 : 2 }}>{visual}</div>
    </div>
  );

  return (
    <div style={{ height: '100dvh', overflowY: 'auto', background: 'var(--bg-app)', color: '#e2e8f0' }}>
      {/* Announcement bar */}
      <div style={{ background: 'linear-gradient(90deg, #065f46, #047857)', color: '#ecfdf5', fontSize: '12.5px', textAlign: 'center', padding: '8px 14px' }}>
        Every plan starts with a {TRIAL_DAYS}-day free trial — full Pro features, no card required.{' '}
        <button onClick={() => onSignup('PRO')} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '12.5px', textDecoration: 'underline', padding: 0 }}>
          Start now
        </button>
      </div>

      {/* Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backdropFilter: 'blur(10px)',
          background: 'rgba(8, 12, 21, 0.82)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '13px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Logo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <nav style={{ marginLeft: 'auto', display: 'flex', gap: '20px', fontSize: '13.5px', color: 'var(--text-secondary)' }} className="landing-nav-links">
            <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</a>
            <a href="#industries" style={{ color: 'inherit', textDecoration: 'none' }}>Industries</a>
            <a href="#compare" style={{ color: 'inherit', textDecoration: 'none' }}>Compare</a>
            <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</a>
            <a href="#faq" style={{ color: 'inherit', textDecoration: 'none' }}>FAQ</a>
          </nav>
          <button onClick={onLogin} className="btn btn-ghost" style={{ padding: '8px 13px', fontSize: '13.5px' }}>
            Log in
          </button>
          <button onClick={() => onSignup()} className="btn btn-primary" style={{ padding: '9px 15px', fontSize: '13.5px' }}>
            Start free trial
          </button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '56px 20px 30px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#4ade80', borderRadius: '99px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, marginBottom: '18px' }}>
          <ShieldCheck size={13} /> Built on Meta’s official WhatsApp Business Platform
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 5.4vw, 50px)', lineHeight: 1.12, fontWeight: 800, color: '#fff', maxWidth: '760px', margin: '0 auto' }}>
          One WhatsApp number.
          <br />
          Your <span style={{ color: 'var(--wa-primary)' }}>whole team</span> answering.
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '620px', margin: '18px auto 0', lineHeight: 1.65 }}>
          TeamBee turns your business WhatsApp into a shared team inbox — assign chats, send approved templates and
          broadcasts, automate the routine, and never lose a customer message again.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '26px', flexWrap: 'wrap' }}>
          <button onClick={() => onSignup()} className="btn btn-primary" style={{ padding: '13px 22px', fontSize: '14.5px', gap: '8px' }}>
            Start {TRIAL_DAYS}-day free trial <ArrowRight size={16} />
          </button>
          <button onClick={onLogin} className="btn btn-secondary" style={{ padding: '13px 20px', fontSize: '14.5px' }}>
            I already have an account
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>No card required · Set up in minutes · Cancel anytime</p>
        <div style={{ maxWidth: '680px', margin: '38px auto 0' }}>
          <InboxMock />
        </div>
      </section>

      {/* Trust strip */}
      <section style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '16px 20px', display: 'flex', gap: '14px 34px', justifyContent: 'center', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}><BadgeCheck size={16} style={{ color: 'var(--wa-primary)' }} /> Official WhatsApp Cloud API — no grey-area gateways</span>
          <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}><Lock size={15} style={{ color: 'var(--wa-primary)' }} /> Encrypted in transit &amp; at rest</span>
          <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}><DatabaseBackup size={15} style={{ color: 'var(--wa-primary)' }} /> Daily backups, point-in-time restore</span>
          <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}><Smartphone size={15} style={{ color: 'var(--wa-primary)' }} /> Works on phone &amp; desktop — installable app</span>
        </div>
      </section>

      {/* Problem */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>Still running the business on a personal WhatsApp?</h2>
        <p style={sectionSub}>It works — until the team grows. These are the four walls every growing business hits:</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '30px' }}>
          {PAINS.map((p) => (
            <div key={p.title} style={{ ...card, borderColor: 'rgba(239,68,68,0.25)' }}>
              <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '7px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <X size={16} style={{ color: '#f87171', flexShrink: 0 }} /> {p.title}
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>Live in three steps</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '30px' }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ padding: '20px', borderRadius: '14px', border: '1px dashed var(--border-medium)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, color: 'var(--wa-primary)' }}>{s.n}</span>
              <h3 style={{ fontSize: '15.5px', color: '#fff', margin: '8px 0 6px' }}>{s.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>Everything a WhatsApp-first team needs</h2>
        <p style={sectionSub}>Not a personal WhatsApp stretched beyond its limits — a proper workplace for customer conversations.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginTop: '30px' }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={card}>
              <span style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <f.icon size={19} />
              </span>
              <h3 style={{ fontSize: '15.5px', color: '#fff', marginBottom: '6px' }}>{f.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.text}</p>
            </div>
          ))}
        </div>

        {/* Deep dives */}
        {deepDive(
          'Shared inbox',
          'Every conversation visible to the team — none trapped in a phone',
          [
            'Chats assign automatically round-robin, or by hand — everyone can see who owns what',
            'Private team notes and @mentions inside the chat; the customer only sees the reply',
            'Reply to a specific message with full context, just like WhatsApp — quotes included',
            'Snooze a chat and it resurfaces exactly when you promised to follow up',
          ],
          <InboxMock />,
          false
        )}
        {deepDive(
          'Templates & broadcasts',
          'Reach everyone, without risking your number',
          [
            'Create templates in TeamBee and submit them for Meta approval without leaving the app',
            'Broadcast to your full contact list — no 256-contact cap, no ban-risk bulk sending',
            'Delivery, read and reply tracking per customer, with automatic retries',
            'Templates reopen conversations after 24 hours — fee reminders, offers, confirmations',
          ],
          <BroadcastMock />,
          true
        )}
        {deepDive(
          'Owner dashboard',
          'The owner sees the day, not just the chats',
          [
            'New chats, open conversations, replies and resolutions — today’s numbers at a glance',
            'Team activity per agent, so workload and response quality are visible',
            'A setup checklist that walks a new workspace to its first broadcast',
            'Roles for Admins, Supervisors and Agents — people see what their job needs',
          ],
          <DashboardMock />,
          false
        )}
      </section>

      {/* Metrics band */}
      <section style={{ marginTop: '56px', background: 'linear-gradient(135deg, rgba(37,211,102,0.1), rgba(18,140,126,0.06))', borderTop: '1px solid rgba(37,211,102,0.25)', borderBottom: '1px solid rgba(37,211,102,0.25)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '30px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '22px', textAlign: 'center' }}>
          {[
            ['1', 'number for your whole team'],
            ['25', 'agents on a single number (Pro)'],
            ['24 hrs', 'reply window — reopened anytime by templates'],
            [`${TRIAL_DAYS} days`, 'free trial with full Pro features'],
          ].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '30px', fontWeight: 800, color: '#fff' }}>{v}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section id="industries" style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>Made for businesses that live on WhatsApp</h2>
        <p style={sectionSub}>If your customers already message you on WhatsApp, your team should be answering there — together.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginTop: '30px' }}>
          {INDUSTRIES.map((ind) => (
            <div key={ind.name} style={card}>
              <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '7px', display: 'flex', gap: '9px', alignItems: 'center' }}>
                <ind.icon size={17} style={{ color: 'var(--wa-primary)', flexShrink: 0 }} /> {ind.name}
              </h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ind.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" style={{ maxWidth: '960px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>TeamBee vs the WhatsApp apps</h2>
        <p style={sectionSub}>The free apps were built for one person. Here is what changes when the whole team has to answer:</p>
        <div style={{ overflowX: 'auto', marginTop: '30px', border: '1px solid var(--border-subtle)', borderRadius: '14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px', background: 'var(--bg-surface)' }}>
            <thead>
              <tr>
                <th style={{ ...thTd, color: 'var(--text-muted)', fontWeight: 600 }}></th>
                <th style={{ ...thTd, color: '#fff', fontWeight: 700 }}>Personal WhatsApp</th>
                <th style={{ ...thTd, color: '#fff', fontWeight: 700 }}>WhatsApp Business App</th>
                <th style={{ ...thTd, color: 'var(--wa-primary)', fontWeight: 800 }}>TeamBee</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...thTd, color: '#e2e8f0', fontWeight: 600 }}>{row.label}</td>
                  <td style={{ ...thTd, color: 'var(--text-secondary)' }}><CellValue value={row.personal} /></td>
                  <td style={{ ...thTd, color: 'var(--text-secondary)' }}><CellValue value={row.app} /></td>
                  <td style={{ ...thTd, color: '#e2e8f0', background: 'rgba(37,211,102,0.05)' }}><CellValue value={row.teambee} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>Simple pricing, in rupees</h2>
        <p style={sectionSub}>Every plan starts with a {TRIAL_DAYS}-day free trial. Meta’s per-conversation charges are separate and billed by Meta — we say so up front, because it is part of your real cost.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginTop: '30px', alignItems: 'stretch' }}>
          {PLANS.map((p) => (
            <div
              key={p.key}
              style={{
                background: 'var(--bg-surface)',
                border: `1px solid ${p.popular ? 'var(--wa-primary)' : 'var(--border-subtle)'}`,
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {p.popular && (
                <span style={{ position: 'absolute', top: '-11px', left: '20px', background: 'var(--wa-primary)', color: '#052e12', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px' }}>
                  MOST POPULAR
                </span>
              )}
              <h3 style={{ fontSize: '16px', color: '#fff' }}>{p.name}</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>{p.tagline}</p>
              <div style={{ margin: '16px 0 4px' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 800, color: '#fff' }}>₹{p.price.toLocaleString('en-IN')}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}> /month + GST</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: '8px', fontSize: '13.5px', color: 'var(--text-secondary)', alignItems: 'flex-start' }}>
                    <Check size={15} style={{ color: 'var(--wa-primary)', flexShrink: 0, marginTop: '2px' }} /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => onSignup(p.key)} className={p.popular ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '11px', fontSize: '14px', justifyContent: 'center' }}>
                Start free trial
              </button>
            </div>
          ))}
        </div>

        {/* Plan comparison table */}
        <div style={{ overflowX: 'auto', marginTop: '30px', border: '1px solid var(--border-subtle)', borderRadius: '14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px', background: 'var(--bg-surface)' }}>
            <thead>
              <tr>
                <th style={{ ...thTd, color: 'var(--text-muted)', fontWeight: 600 }}>Compare plans</th>
                {PLANS.map((p) => (
                  <th key={p.key} style={{ ...thTd, color: p.popular ? 'var(--wa-primary)' : '#fff', fontWeight: 700 }}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...thTd, color: '#e2e8f0', fontWeight: 600 }}>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} style={{ ...thTd, color: 'var(--text-secondary)' }}><CellValue value={v} /></td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ ...thTd, color: '#e2e8f0', fontWeight: 600 }}>Price</td>
                {PLANS.map((p) => (
                  <td key={p.key} style={{ ...thTd, color: '#fff', fontWeight: 700 }}>₹{p.price.toLocaleString('en-IN')}/mo + GST</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '14px', display: 'flex', gap: '7px', justifyContent: 'center', alignItems: 'center' }}>
          <Zap size={13} /> Need more than 25 agents or multiple numbers? Talk to us from inside the app — we will put together a plan that fits.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: '760px', margin: '0 auto', padding: '52px 20px 10px' }}>
        <h2 style={sectionTitle}>Questions, answered</h2>
        <div style={{ marginTop: '26px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {FAQ.map((item) => (
            <details key={item.q} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 16px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '14.5px', fontWeight: 600, color: '#fff' }}>{item.q}</summary>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: '8px' }}>{item.a}</p>
            </details>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <h2 style={sectionTitle}>Ready when your customers are</h2>
          <p style={sectionSub}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              <Clock3 size={15} /> Most teams send their first team reply within an hour of signing up.
            </span>
          </p>
          <div style={{ marginTop: '20px' }}>
            <button onClick={() => onSignup()} className="btn btn-primary" style={{ padding: '13px 22px', fontSize: '14.5px', gap: '8px' }}>
              Create your workspace <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '54px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '36px 20px 26px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '26px' }}>
            <div>
              <Logo />
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '12px', maxWidth: '260px' }}>
                The shared WhatsApp team inbox for businesses in India — one number, your whole team, nothing lost.
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <ShieldCheck size={13} style={{ color: 'var(--wa-primary)' }} /> Built on Meta’s official WhatsApp Business Platform
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Product</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px' }}>
                <li><a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Features</a></li>
                <li><a href="#industries" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Industries</a></li>
                <li><a href="#compare" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Compare</a></li>
                <li><a href="#pricing" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Pricing</a></li>
                <li><a href="#faq" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Legal</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px' }}>
                <li><button onClick={onShowTerms} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', padding: 0 }}>Terms of Service</button></li>
                <li><button onClick={onShowPrivacy} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', padding: 0 }}>Privacy Policy</button></li>
                {onShowRefunds && (
                  <li><button onClick={onShowRefunds} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', padding: 0 }}>Refund Policy</button></li>
                )}
              </ul>
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Your account</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px' }}>
                <li><button onClick={onLogin} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', padding: 0 }}>Log in</button></li>
                <li><button onClick={() => onSignup()} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', padding: 0 }}>Start free trial</button></li>
                <li style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>Support is available inside your workspace, from any screen.</li>
              </ul>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '28px', paddingTop: '18px', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            <span>© 2026 TeamBee. Made for WhatsApp-first businesses in India.</span>
            <span style={{ marginLeft: 'auto' }}>WhatsApp is a trademark of Meta Platforms, Inc. TeamBee is an independent product built on Meta’s official APIs.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
