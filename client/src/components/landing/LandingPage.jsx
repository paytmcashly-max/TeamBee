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
  ArrowRight,
  ShieldCheck,
  Clock3,
} from 'lucide-react';
import { PLANS, TRIAL_DAYS } from '../../data/plans';

// The public face of TeamBee. Until this existed, the product opened
// straight on a login form — no story, no pricing, nothing to sell.
// Logged-out visitors land here; the app itself is one click away.

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

const STEPS = [
  { n: '1', title: 'Create your workspace', text: `Sign up in a minute. Your ${TRIAL_DAYS}-day free trial starts immediately — no card needed.` },
  { n: '2', title: 'Connect your WhatsApp number', text: 'Link your business number through Meta’s official setup. Your existing number and chats stay yours.' },
  { n: '3', title: 'Invite your team', text: 'Add agents, assign roles, and start replying together from day one.' },
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
    a: `You pick a plan and continue — your data, templates and team stay exactly as they are. If you do nothing, the workspace pauses; nothing is deleted.`,
  },
  {
    q: 'Does Meta charge anything extra?',
    a: 'Meta charges per conversation (utility messages are the cheapest, marketing costs more) — those charges are Meta’s, billed by Meta. TeamBee’s subscription covers the software.',
  },
  {
    q: 'How many team members can I add?',
    a: 'It depends on your plan — Starter includes 3 agents, Growth 10 and Pro 25. Every agent gets their own login and role (Admin, Supervisor or Agent).',
  },
];

function Logo() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px' }}>
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
        gridTemplateColumns: '170px 1fr',
        minHeight: '300px',
        textAlign: 'left',
      }}
    >
      <div style={{ borderRight: '1px solid var(--border-subtle)', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {row('Aarav Parent', 'Demo class confirmed, thank you!', '10:24', true)}
        {row('Sharma Ji', 'Fees receipt bhej dijiye', '09:51', false)}
        {row('New Admission', 'Class 10 batch timings?', '09:12', false)}
        {row('Priya Ma’am', 'Test series kab start hogi?', 'Yesterday', false)}
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
          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--wa-primary)', display: 'inline-flex' }} />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onLogin, onSignup, onShowTerms, onShowPrivacy }) {
  const sectionTitle = { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 800, color: '#fff', textAlign: 'center' };
  const sectionSub = { fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '560px', margin: '10px auto 0', lineHeight: 1.6 };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', color: '#e2e8f0', overflowY: 'auto' }}>
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
          <Logo />
          <nav style={{ marginLeft: 'auto', display: 'flex', gap: '20px', fontSize: '13.5px', color: 'var(--text-secondary)' }} className="landing-nav-links">
            <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</a>
            <a href="#pricing" style={{ color: 'inherit', textDecoration: 'none' }}>Pricing</a>
            <a href="#faq" style={{ color: 'inherit', textDecoration: 'none' }}>FAQ</a>
          </nav>
          <button onClick={onLogin} className="btn btn-ghost" style={{ padding: '8px 13px', fontSize: '13.5px' }}>
            Log in
          </button>
          <button onClick={onSignup} className="btn btn-primary" style={{ padding: '9px 15px', fontSize: '13.5px' }}>
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
          <button onClick={onSignup} className="btn btn-primary" style={{ padding: '13px 22px', fontSize: '14.5px', gap: '8px' }}>
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

      {/* Features */}
      <section id="features" style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>Everything a WhatsApp-first team needs</h2>
        <p style={sectionSub}>Not a personal WhatsApp stretched beyond its limits — a proper workplace for customer conversations.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px', marginTop: '30px' }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '20px' }}>
              <span style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <f.icon size={19} />
              </span>
              <h3 style={{ fontSize: '15.5px', color: '#fff', marginBottom: '6px' }}>{f.title}</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.text}</p>
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

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 20px 8px' }}>
        <h2 style={sectionTitle}>Simple pricing, in rupees</h2>
        <p style={sectionSub}>Every plan starts with a {TRIAL_DAYS}-day free trial. Meta’s per-conversation charges are separate and billed by Meta.</p>
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
              <button onClick={onSignup} className={p.popular ? 'btn btn-primary' : 'btn btn-secondary'} style={{ padding: '11px', fontSize: '14px', justifyContent: 'center' }}>
                Start free trial
              </button>
            </div>
          ))}
        </div>
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
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '14px' }}>
            <Clock3 size={15} /> Most teams send their first team reply within an hour of signing up.
          </div>
          <div>
            <button onClick={onSignup} className="btn btn-primary" style={{ padding: '13px 22px', fontSize: '14.5px', gap: '8px' }}>
              Create your workspace <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '54px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '22px 20px', display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Logo />
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>© 2026 TeamBee. Made for WhatsApp-first businesses in India.</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '18px', fontSize: '13px' }}>
            <button onClick={onShowTerms} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Terms</button>
            <button onClick={onShowPrivacy} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Privacy</button>
            <button onClick={onLogin} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>Log in</button>
          </span>
        </div>
      </footer>
    </div>
  );
}
