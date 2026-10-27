import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import LoginView from './components/auth/LoginView';
import SignupView from './components/auth/SignupView';
import ForgotPasswordView from './components/auth/ForgotPasswordView';
import ResetPasswordView from './components/auth/ResetPasswordView';
import LandingPage from './components/landing/LandingPage';
import { TermsView, PrivacyView, RefundsView } from './components/landing/LegalViews';
const DashboardView = lazy(() => import('./components/dashboard/DashboardView'));
import ConversationList from './components/inbox/ConversationList';
import ChatCanvas from './components/inbox/ChatCanvas';
import ContactSidebar from './components/inbox/ContactSidebar';
// Modals are heavy and most sessions never open some of them — split them
// out of the initial bundle and fetch each on first use.
const MetaOnboardingModal = lazy(() => import('./components/modals/MetaOnboardingModal'));
import ErrorBoundary from './components/ErrorBoundary';
import { useSocket } from './context/SocketContext';
const TemplateModal = lazy(() => import('./components/modals/TemplateModal'));
const AgentManagementModal = lazy(() => import('./components/modals/AgentManagementModal'));
const BroadcastModal = lazy(() => import('./components/modals/BroadcastModal'));

export default function App() {
  const { agent, loading, tenant, logout } = useAuth();
  const { activeChat, activeChatId, selectChat } = useChat();
  const { connected } = useSocket();

  // Public (logged-out) views: the product's front door. A visitor now
  // meets a landing page with pricing and a real signup — not a bare
  // login form.
  const [publicView, setPublicView] = useState('landing');
  // The plan a visitor picked on the pricing section; the signup form
  // opens with it selected instead of silently defaulting to Pro.
  const [signupPlan, setSignupPlan] = useState('PRO');
  const showSignup = (plan) => {
    if (typeof plan === 'string' && ['STARTER', 'GROWTH', 'PRO'].includes(plan)) {
      setSignupPlan(plan);
    }
    setPublicView('signup');
  };
  // Password-reset email links land on /?reset=<token>.
  const [resetToken] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('reset') || '';
    } catch {
      return '';
    }
  });
  // Logged-in home: owners land on the dashboard, agents in the inbox.
  const [mainView, setMainView] = useState(null);
  useEffect(() => {
    if (agent && mainView === null) {
      setMainView(agent.role === 'ADMIN' || agent.role === 'SUPERVISOR' ? 'dashboard' : 'inbox');
    }
    if (!agent) setMainView(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Mobile drill-in history: on a phone, opening a chat pushes one history
  // entry so the device/browser Back button returns to the conversation
  // list instead of leaving the app. Desktop keeps plain state navigation.
  const chatHistoryArmedRef = useRef(false);
  useEffect(() => {
    const chatOpen = Boolean(activeChat || activeChatId);
    if (
      chatOpen &&
      !chatHistoryArmedRef.current &&
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 768px)').matches
    ) {
      window.history.pushState({ teambeeChat: true }, '');
      chatHistoryArmedRef.current = true;
    }
    if (!chatOpen) chatHistoryArmedRef.current = false;
  }, [activeChat, activeChatId]);

  useEffect(() => {
    const onPopState = () => {
      if (chatHistoryArmedRef.current) {
        chatHistoryArmedRef.current = false;
        selectChat(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [selectChat]);

  const handleMobileBack = () => {
    if (chatHistoryArmedRef.current) {
      window.history.back(); // the popstate handler closes the chat
    } else {
      selectChat(null);
    }
  };

  // iOS Safari keyboard handling: the interactive-widget viewport keyword
  // is not shipped in Safari, so there the layout viewport does NOT shrink
  // when the keyboard opens and the in-flow composer can end up hidden
  // behind the keyboard. Track the VisualViewport instead: while the
  // keyboard is open, size the app shell to the visible area (its height
  // + offsetTop). Android Chrome already resizes the layout viewport via
  // interactive-widget=resizes-content, so this fallback runs on iOS only.
  const appShellRef = useRef(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const el = appShellRef.current;
    if (!vv || !el) return;
    const isIOS =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (vv.scale !== 1) {
          el.style.height = '';
          el.style.transform = '';
          return;
        }
        const keyboardOpen = vv.height < window.innerHeight - 60;
        if (keyboardOpen) {
          el.style.height = `${Math.round(vv.height)}px`;
          el.style.transform = `translateY(${Math.round(vv.offsetTop)}px)`;
        } else {
          el.style.height = '';
          el.style.transform = '';
        }
      });
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    apply();
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      cancelAnimationFrame(raf);
      el.style.height = '';
      el.style.transform = '';
    };
  }, [agent]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-app)',
          color: '#25D366',
          fontSize: '15px',
          fontWeight: '600',
        }}
      >
        Loading TeamBee...
      </div>
    );
  }

  if (!agent) {
    if (resetToken && publicView !== 'login-after-reset') {
      return (
        <ResetPasswordView
          token={resetToken}
          onDone={() => {
            try {
              window.history.replaceState({}, '', window.location.pathname);
            } catch {}
            setPublicView('login-after-reset');
          }}
        />
      );
    }
    if (publicView === 'forgot') {
      return (
        <ForgotPasswordView
          onBack={() => setPublicView('login')}
          onHome={() => setPublicView('landing')}
        />
      );
    }
    if (publicView === 'login' || publicView === 'login-after-reset') {
      return (
        <LoginView
          onShowSignup={() => setPublicView('signup')}
          onBack={() => setPublicView('landing')}
          onForgot={() => setPublicView('forgot')}
        />
      );
    }
    if (publicView === 'signup') {
      return (
        <SignupView
          initialPlan={signupPlan}
          onBack={() => setPublicView('landing')}
          onShowLogin={() => setPublicView('login')}
          onShowTerms={() => setPublicView('terms')}
          onShowPrivacy={() => setPublicView('privacy')}
        />
      );
    }
    if (publicView === 'terms') return <TermsView onBack={() => setPublicView('landing')} />;
    if (publicView === 'refunds') return <RefundsView onBack={() => setPublicView('landing')} />;
    if (publicView === 'privacy') return <PrivacyView onBack={() => setPublicView('landing')} />;
    return (
      <LandingPage
        onLogin={() => setPublicView('login')}
        onSignup={showSignup}
        onShowTerms={() => setPublicView('terms')}
        onShowPrivacy={() => setPublicView('privacy')}
        onShowRefunds={() => setPublicView('refunds')}
      />
    );
  }

  const trialDaysLeft =
    tenant?.subscriptionStatus === 'TRIAL' && tenant?.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000))
      : null;
  const subscriptionExpired = tenant?.subscriptionStatus === 'EXPIRED';
  // An expired workspace keeps its dashboard (and the upgrade path) but
  // not the inbox — the trial's whole point.
  const effectiveMainView = subscriptionExpired ? 'dashboard' : mainView || 'inbox';

  return (
    <ErrorBoundary>
    <div className="app-container" ref={appShellRef}>
      {!connected && (
        <div className="connection-banner" role="alert">
          Connection lost — reconnecting to TeamBee… New messages will appear once the connection is back.
        </div>
      )}
      {tenant?.subscriptionStatus === 'TRIAL' && trialDaysLeft !== null && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.12)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fcd34d',
            fontSize: '12.5px',
            padding: '7px 14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            flex: '0 0 auto',
          }}
          role="status"
        >
          <span>Free trial — {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left on Pro.</span>
          <button
            type="button"
            onClick={() => setMainView('dashboard')}
            style={{ background: 'none', border: 'none', color: '#fde68a', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '12.5px', padding: 0 }}
          >
            See plans
          </button>
        </div>
      )}
      {subscriptionExpired && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            fontSize: '12.5px',
            padding: '7px 14px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            flex: '0 0 auto',
          }}
          role="alert"
        >
          <span>Your free trial has ended — the inbox is paused. Pick a plan below to continue.</span>
          <button
            type="button"
            onClick={logout}
            style={{ background: 'none', border: 'none', color: '#fecaca', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '12.5px', padding: 0 }}
          >
            Sign out
          </button>
        </div>
      )}
      {effectiveMainView === 'dashboard' ? (
        <Suspense fallback={null}>
          <DashboardView
            onOpenInbox={() => setMainView('inbox')}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenTemplates={() => setIsTemplateModalOpen(true)}
            onOpenBroadcasts={() => setIsBroadcastModalOpen(true)}
            onOpenAgents={() => setIsAgentsModalOpen(true)}
          />
        </Suspense>
      ) : (
      /* 3-Column WhatsApp Shared Inbox Layout */
      <div className={`inbox-layout ${(activeChat || activeChatId) ? 'has-active-chat' : 'no-active-chat'}`}>
        {/* Column 1: Navigation & Conversation List */}
        <ConversationList
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenTemplates={() => setIsTemplateModalOpen(true)}
          onOpenBroadcasts={() => setIsBroadcastModalOpen(true)}
          onOpenAgents={() => setIsAgentsModalOpen(true)}
          onOpenDashboard={() => setMainView('dashboard')}
        />

        {/* Column 2: Active Chat Canvas */}
        <ChatCanvas
          onOpenTemplatePicker={() => setIsTemplateModalOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          onBack={handleMobileBack}
        />

        {/* Backdrop for Mobile/Tablet CRM drawer */}
        {isSidebarOpen && activeChat && (
          <div
            className="crm-drawer-backdrop"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Column 3: Contact & CRM Intelligence Sidebar */}
        {isSidebarOpen && activeChat && (
          <ContactSidebar
            onOpenTemplatePicker={() => setIsTemplateModalOpen(true)}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}
      </div>
      )}

      {/* Modals & Consoles */}
      <Suspense fallback={null}>
        <MetaOnboardingModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <TemplateModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} />
        <BroadcastModal isOpen={isBroadcastModalOpen} onClose={() => setIsBroadcastModalOpen(false)} />
        <AgentManagementModal isOpen={isAgentsModalOpen} onClose={() => setIsAgentsModalOpen(false)} />
      </Suspense>
    </div>
    </ErrorBoundary>
  );
}
