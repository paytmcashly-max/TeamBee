import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import LoginView from './components/auth/LoginView';
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
  const { agent, loading } = useAuth();
  const { activeChat, activeChatId, selectChat } = useChat();
  const { connected } = useSocket();

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
    return <LoginView />;
  }

  return (
    <ErrorBoundary>
    <div className="app-container" ref={appShellRef}>
      {!connected && (
        <div className="connection-banner" role="alert">
          Connection lost — reconnecting to TeamBee… New messages will appear once the connection is back.
        </div>
      )}
      {/* 3-Column WhatsApp Shared Inbox Layout */}
      <div className={`inbox-layout ${(activeChat || activeChatId) ? 'has-active-chat' : 'no-active-chat'}`}>
        {/* Column 1: Navigation & Conversation List */}
        <ConversationList
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenTemplates={() => setIsTemplateModalOpen(true)}
          onOpenBroadcasts={() => setIsBroadcastModalOpen(true)}
          onOpenAgents={() => setIsAgentsModalOpen(true)}
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
