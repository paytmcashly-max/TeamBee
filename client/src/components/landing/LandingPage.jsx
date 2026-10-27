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

// The public face of TeamBee — structure follows the canonical SaaS
// order (researched against Interakt/Linear/Atlassian-class sites);
// ALL styling comes from the design system (styles/tokens.css +
// styles/components.css). No inline styles except data-driven
// values (chart widths). Every claim here is a product fact.

const FEATURES = [
  { icon: Users, title: 'Shared team inbox', text: 'Your whole team replies from one WhatsApp number — no more personal phones, no lost chats when someone is on leave.' },
  { icon: Sparkles, title: 'Templates that reopen chats', text: 'Meta-approved templates restart conversations after the 24-hour window — reminders, confirmations, offers.' },
  { icon: Megaphone, title: 'Broadcast campaigns', text: 'Send one message to hundreds of customers with delivery tracking, retries and per-person status.' },
  { icon: Bot, title: 'Automation & assignment', text: 'Auto-assign chats round-robin, greet customers outside office hours, and never let a chat sit unanswered.' },
  { icon: Tags, title: 'Tags, notes & mentions', text: 'Organise customers with tags and custom fields, discuss privately with team notes and @mentions.' },
  { icon: BarChart3, title: 'Owner dashboard', text: 'See today’s chats, open conversations and team activity at a glance — the numbers the owner actually runs on.' },
];

const PAINS = [
  { title: 'One phone, one person', text: 'The business number lives on a single phone. When that person is busy, travelling or leaves the job, customer chats stop — or walk away with them.' },
  { title: 'Nobody knows who replied', text: 'No record of which customer was answered, by whom, or what was promised. Follow-ups fall through the cracks every single day.' },
  { title: 'Broadcasts that risk a ban', text: 'The WhatsApp app caps broadcasts at 256 contacts and flags bulk sending from a normal number. One block and your business line is gone.' },
  { title: 'The 24-hour wall', text: 'A customer messages on Friday; by Monday the reply window feels closed and the lead has bought from someone else.' },
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
  { q: 'Is this the official WhatsApp API?', a: 'Yes. TeamBee is built on Meta’s official WhatsApp Business Platform (Cloud API) — the same foundation large companies use. No unofficial gateways, no ban risk from grey-area tools.' },
  { q: 'Can I use my existing WhatsApp number?', a: 'In most cases yes — a number can be migrated to the Business Platform. Our setup wizard walks you through it, and you keep the same number your customers already know.' },
  { q: 'What happens after the free trial?', a: 'You pick a plan and continue — your data, templates and team stay exactly as they are. Every workspace gets full Pro features during the trial; afterwards the plan you chose at signup applies. If you do nothing, the workspace pauses; nothing is deleted.' },
  { q: 'Does Meta charge anything extra?', a: 'Meta charges per conversation (utility messages are the cheapest, marketing costs more) — those charges are Meta’s, billed by Meta, and are separate from your TeamBee subscription. Service conversations within the 24-hour window are Meta’s cheapest category. We show this openly because it is the second bill every WhatsApp API provider has — most just don’t mention it.' },
  { q: 'How many team members can I add?', a: 'It depends on your plan — Starter includes 3 agents, Growth 10 and Pro 25. Every agent gets their own login and role (Admin, Supervisor or Agent).' },
  { q: 'Is my customer data safe with TeamBee?', a: 'Your data is stored on established cloud infrastructure, transmitted over encrypted connections, and isolated per workspace at the database level. We never sell your data or use your conversations for advertising. Details are in the Privacy Policy below.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Paid plans are billed monthly in advance; you can cancel anytime and keep access until the end of the paid period. There is no cancellation fee, and your number and data remain yours.' },
  { q: 'Do you offer a demo or onboarding help?', a: 'The setup is self-serve and most teams are live the same day — connect your number with the in-app wizard, invite your team, and send a first template. If you get stuck, support is available inside your workspace.' },
];

function Logo({ onClick }) {
  return (
    <span className="brand" onClick={onClick} role={onClick ? 'button' : undefined} title={onClick ? 'Back to top' : undefined} style={onClick ? { cursor: 'pointer' } : undefined}>
      <span className="brand-mark"><MessageSquare size={18} /></span>
      <span className="brand-name">TeamBee</span>
    </span>
  );
}

function CellValue({ value }) {
  if (value === true) return <Check size={16} className="t-accent" aria-label="Included" />;
  if (value === false) return <X size={15} style={{ color: 'var(--text-muted)' }} aria-label="Not included" />;
  return <span>{value}</span>;
}

function InboxMock() {
  const row = (name, preview, time, active) => (
    <div className={`mock-row${active ? ' active' : ''}`}>
      <span className="mock-avatar">{name.split(' ').map((w) => w[0]).join('')}</span>
      <span className="mock-row-main">
        <span className="mock-row-name">{name}</span>
        <span className="mock-row-preview">{preview}</span>
      </span>
      <span className="mock-row-time">{time}</span>
    </div>
  );
  return (
    <div className="mock mock-inbox" aria-hidden="true">
      <div className="mock-list">
        {row('Aarav', 'Demo class confirmed!', '10:24', true)}
        {row('Sharma Ji', 'Fees receipt please', '09:51', false)}
        {row('Admissions', 'Class 10 timings?', '09:12', false)}
        {row('Priya', 'Test series dates?', 'Yesterday', false)}
      </div>
      <div className="mock-chat">
        <div className="mock-bubble in">Hello, I want to confirm tomorrow’s demo class for Aarav.</div>
        <div className="mock-bubble out">Confirmed! Tomorrow 5 PM. Our teacher will call 10 minutes before. 🙏</div>
        <div className="mock-note">Assigned to Rahul · Team note added</div>
        <div className="mock-composer">
          <span>Type a WhatsApp message…</span>
          <span className="mock-send"><Send size={11} /></span>
        </div>
      </div>
    </div>
  );
}

function BroadcastMock() {
  const bar = (label, pct, color) => (
    <div>
      <div className="mock-bar-row"><span>{label}</span><b>{pct}%</b></div>
      <div className="mock-bar"><i style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
  return (
    <div className="mock mock-panel" aria-hidden="true">
      <div className="mock-panel-head">
        <span className="mock-panel-icon"><Megaphone size={15} /></span>
        <span className="mock-panel-title">Diwali offer campaign</span>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>SENT</span>
      </div>
      <p className="t-caption">Template: festival_offer · 1,240 recipients</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        {bar('Delivered', 98, '#25D366')}
        {bar('Read', 81, '#38bdf8')}
        {bar('Replied', 34, '#a78bfa')}
      </div>
      <p className="t-caption" style={{ marginTop: 'var(--space-4)' }}>Per-customer status, automatic retries for failed sends.</p>
    </div>
  );
}

function DashboardMock() {
  const stat = (value, label) => (
    <div className="mock-stat"><b>{value}</b><span>{label}</span></div>
  );
  return (
    <div className="mock mock-panel" aria-hidden="true">
      <div className="mock-panel-head">
        <span className="mock-panel-icon"><BarChart3 size={15} /></span>
        <span className="mock-panel-title">Today at your business</span>
      </div>
      <div className="mock-stat-grid">
        {stat('46', 'New chats')}
        {stat('12', 'Open conversations')}
        {stat('183', 'Replies sent')}
        {stat('39', 'Resolved today')}
      </div>
      <p className="t-caption" style={{ marginTop: 'var(--space-3)' }}>Team activity and response numbers, refreshed live.</p>
    </div>
  );
}

export default function LandingPage({ onLogin, onSignup, onShowTerms, onShowPrivacy, onShowRefunds }) {
  const deepDive = (kicker, title, points, visual, flip) => (
    <div className={`deep-dive${flip ? ' flip' : ''}`}>
      <div className="dd-copy">
        <span className="eyebrow">{kicker}</span>
        <h3 className="dd-title">{title}</h3>
        <ul className="dd-points">
          {points.map((pt) => (
            <li key={pt}><Check size={16} /> {pt}</li>
          ))}
        </ul>
      </div>
      <div className="dd-visual">{visual}</div>
    </div>
  );

  return (
    <div className="view-scroll">
      <div className="announce">
        Every plan starts with a {TRIAL_DAYS}-day free trial — full Pro features, no card required.{' '}
        <button onClick={() => onSignup('PRO')}>Start now</button>
      </div>

      <header className="site-header">
        <div className="nav-inner">
          <Logo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
          <nav className="nav-links landing-nav-links">
            <a href="#features">Features</a>
            <a href="#industries">Industries</a>
            <a href="#compare">Compare</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <button onClick={onLogin} className="btn btn-ghost btn-sm">Log in</button>
          <button onClick={() => onSignup()} className="btn btn-primary btn-sm">Start free trial</button>
        </div>
      </header>

      <section className="container hero">
        <span className="badge badge-soft"><ShieldCheck size={13} /> Built on Meta’s official WhatsApp Business Platform</span>
        <h1 className="t-display" style={{ maxWidth: '760px', margin: 'var(--space-5) auto 0' }}>
          One WhatsApp number.<br />Your <span className="t-accent">whole team</span> answering.
        </h1>
        <p className="hero-sub">
          TeamBee turns your business WhatsApp into a shared team inbox — assign chats, send approved templates and
          broadcasts, automate the routine, and never lose a customer message again.
        </p>
        <div className="hero-ctas">
          <button onClick={() => onSignup()} className="btn btn-primary btn-lg">Start {TRIAL_DAYS}-day free trial <ArrowRight size={16} /></button>
          <button onClick={onLogin} className="btn btn-secondary btn-lg">I already have an account</button>
        </div>
        <p className="hero-note">No card required · Set up in minutes · Cancel anytime</p>
        <div className="hero-visual"><InboxMock /></div>
      </section>

      <section className="trust-strip" style={{ marginTop: 'var(--space-16)' }}>
        <div className="container trust-inner">
          <span><BadgeCheck size={16} /> Official WhatsApp Cloud API — no grey-area gateways</span>
          <span><Lock size={15} /> Encrypted in transit &amp; at rest</span>
          <span><DatabaseBackup size={15} /> Daily backups, point-in-time restore</span>
          <span><Smartphone size={15} /> Works on phone &amp; desktop — installable app</span>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2 className="section-title">Still running the business on a personal WhatsApp?</h2>
          <p className="section-sub">It works — until the team grows. These are the four walls every growing business hits:</p>
        </div>
        <div className="grid grid-4">
          {PAINS.map((p) => (
            <div key={p.title} className="card pain-card">
              <h3 className="pain-title"><X size={16} /> {p.title}</h3>
              <p className="card-text">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section-tight">
        <div className="section-head"><h2 className="section-title">Live in three steps</h2></div>
        <div className="grid grid-3">
          {STEPS.map((s) => (
            <div key={s.n} className="step-card">
              <span className="step-num">{s.n}</span>
              <h3 className="card-title" style={{ marginTop: 'var(--space-2)' }}>{s.title}</h3>
              <p className="card-text">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="container section">
        <div className="section-head">
          <h2 className="section-title">Everything a WhatsApp-first team needs</h2>
          <p className="section-sub">Not a personal WhatsApp stretched beyond its limits — a proper workplace for customer conversations.</p>
        </div>
        <div className="grid grid-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <span className="card-icon"><f.icon size={19} /></span>
              <h3 className="card-title">{f.title}</h3>
              <p className="card-text">{f.text}</p>
            </div>
          ))}
        </div>

        {deepDive('Shared inbox', 'Every conversation visible to the team — none trapped in a phone', [
          'Chats assign automatically round-robin, or by hand — everyone can see who owns what',
          'Private team notes and @mentions inside the chat; the customer only sees the reply',
          'Reply to a specific message with full context, just like WhatsApp — quotes included',
          'Snooze a chat and it resurfaces exactly when you promised to follow up',
        ], <InboxMock />, false)}
        {deepDive('Templates & broadcasts', 'Reach everyone, without risking your number', [
          'Create templates in TeamBee and submit them for Meta approval without leaving the app',
          'Broadcast to your full contact list — no 256-contact cap, no ban-risk bulk sending',
          'Delivery, read and reply tracking per customer, with automatic retries',
          'Templates reopen conversations after 24 hours — fee reminders, offers, confirmations',
        ], <BroadcastMock />, true)}
        {deepDive('Owner dashboard', 'The owner sees the day, not just the chats', [
          'New chats, open conversations, replies and resolutions — today’s numbers at a glance',
          'Team activity per agent, so workload and response quality are visible',
          'A setup checklist that walks a new workspace to its first broadcast',
          'Roles for Admins, Supervisors and Agents — people see what their job needs',
        ], <DashboardMock />, false)}
      </section>

      <section className="metrics-band">
        <div className="container metrics-grid">
          {[['1', 'number for your whole team'], ['25', 'agents on a single number (Pro)'], ['24 hrs', 'reply window — reopened anytime by templates'], [`${TRIAL_DAYS} days`, 'free trial with full Pro features']].map(([v, l]) => (
            <div key={l}><div className="metric-value">{v}</div><div className="metric-label">{l}</div></div>
          ))}
        </div>
      </section>

      <section id="industries" className="container section">
        <div className="section-head">
          <h2 className="section-title">Made for businesses that live on WhatsApp</h2>
          <p className="section-sub">If your customers already message you on WhatsApp, your team should be answering there — together.</p>
        </div>
        <div className="grid grid-3">
          {INDUSTRIES.map((ind) => (
            <div key={ind.name} className="card">
              <h3 className="card-title" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <ind.icon size={17} className="t-accent" /> {ind.name}
              </h3>
              <p className="card-text">{ind.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="compare" className="container section" style={{ maxWidth: '960px' }}>
        <div className="section-head">
          <h2 className="section-title">TeamBee vs the WhatsApp apps</h2>
          <p className="section-sub">The free apps were built for one person. Here is what changes when the whole team has to answer:</p>
        </div>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: '640px' }}>
            <thead>
              <tr><th></th><th>Personal WhatsApp</th><th>WhatsApp Business App</th><th className="col-brand">TeamBee</th></tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td><CellValue value={row.personal} /></td>
                  <td><CellValue value={row.app} /></td>
                  <td className="col-brand"><CellValue value={row.teambee} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="pricing" className="container section">
        <div className="section-head">
          <h2 className="section-title">Simple pricing, in rupees</h2>
          <p className="section-sub">Every plan starts with a {TRIAL_DAYS}-day free trial. Meta’s per-conversation charges are separate and billed by Meta — we say so up front, because it is part of your real cost.</p>
        </div>
        <div className="grid grid-3" style={{ alignItems: 'stretch' }}>
          {PLANS.map((p) => (
            <div key={p.key} className={`price-card${p.popular ? ' popular' : ''}`}>
              {p.popular && <span className="price-flag">MOST POPULAR</span>}
              <h3 className="price-name">{p.name}</h3>
              <p className="price-tag">{p.tagline}</p>
              <div className="price-amount"><b>₹{p.price.toLocaleString('en-IN')}</b> <span>/month + GST</span></div>
              <ul className="price-features">
                {p.features.map((f) => (
                  <li key={f}><Check size={15} /> {f}</li>
                ))}
              </ul>
              <button onClick={() => onSignup(p.key)} className={`btn ${p.popular ? 'btn-primary' : 'btn-secondary'} btn-block`}>Start free trial</button>
            </div>
          ))}
        </div>

        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: '560px' }}>
            <thead>
              <tr><th>Compare plans</th>{PLANS.map((p) => (<th key={p.key} className={p.popular ? 'col-brand' : undefined}>{p.name}</th>))}</tr>
            </thead>
            <tbody>
              {PLAN_ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (<td key={i}><CellValue value={v} /></td>))}
                </tr>
              ))}
              <tr>
                <th scope="row">Price</th>
                {PLANS.map((p) => (<td key={p.key} style={{ color: 'var(--text-main)', fontWeight: 700 }}>₹{p.price.toLocaleString('en-IN')}/mo + GST</td>))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="t-caption" style={{ textAlign: 'center', marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', alignItems: 'center' }}>
          <Zap size={13} /> Need more than 25 agents or multiple numbers? Talk to us from inside the app — we will put together a plan that fits.
        </p>
      </section>

      <section id="faq" className="container-narrow section">
        <div className="section-head"><h2 className="section-title">Questions, answered</h2></div>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--space-12)' }}>
          <h2 className="section-title">Ready when your customers are</h2>
          <p className="section-sub" style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', alignItems: 'center' }}>
            <Clock3 size={15} /> Most teams send their first team reply within an hour of signing up.
          </p>
          <div style={{ marginTop: 'var(--space-5)' }}>
            <button onClick={() => onSignup()} className="btn btn-primary btn-lg">Create your workspace <ArrowRight size={16} /></button>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <Logo />
              <p className="t-small" style={{ marginTop: 'var(--space-3)', maxWidth: '260px' }}>
                The shared WhatsApp team inbox for businesses in India — one number, your whole team, nothing lost.
              </p>
              <p className="t-caption" style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                <ShieldCheck size={13} className="t-accent" /> Built on Meta’s official WhatsApp Business Platform
              </p>
            </div>
            <div className="footer-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#industries">Industries</a></li>
                <li><a href="#compare">Compare</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <ul>
                <li><button onClick={onShowTerms}>Terms of Service</button></li>
                <li><button onClick={onShowPrivacy}>Privacy Policy</button></li>
                {onShowRefunds && <li><button onClick={onShowRefunds}>Refund Policy</button></li>}
              </ul>
            </div>
            <div className="footer-col">
              <h4>Your account</h4>
              <ul>
                <li><button onClick={onLogin}>Log in</button></li>
                <li><button onClick={() => onSignup()}>Start free trial</button></li>
                <li className="t-caption">Support is available inside your workspace, from any screen.</li>
              </ul>
            </div>
          </div>
          <div className="footer-base">
            <span>© 2026 TeamBee. Made for WhatsApp-first businesses in India.</span>
            <span className="right">WhatsApp is a trademark of Meta Platforms, Inc. TeamBee is an independent product built on Meta’s official APIs.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
