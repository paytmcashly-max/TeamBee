import React, { useState, useEffect, useRef } from 'react';
import { Search, HelpCircle, Menu } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import LoginView from './components/auth/LoginView';
import ResetPasswordView from './components/auth/ResetPasswordView';
import WorkspaceSidebar from './components/inbox/WorkspaceSidebar';
import ConversationList from './components/inbox/ConversationList';
import ChatCanvas from './components/inbox/ChatCanvas';
import ContactSidebar from './components/inbox/ContactSidebar';
import OverviewView from './components/pages/OverviewView';
import BroadcastsView from './components/pages/BroadcastsView';
import AutomationView from './components/pages/AutomationView';
import CommerceView from './components/pages/CommerceView';
import TeamView from './components/pages/TeamView';
import SettingsView from './components/pages/SettingsView';
import TemplatesView from './components/pages/TemplatesView';
import ContactsView from './components/pages/ContactsView';
import TemplateModal from './components/modals/TemplateModal';
import NewChatModal from './components/modals/NewChatModal';
import CommerceSendModal from './components/modals/CommerceSendModal';

const VIEW_LABELS = {
  inbox: 'Inbox',
  overview: 'Overview',
  contacts: 'Contacts',
  templates: 'Templates',
  broadcasts: 'Broadcasts',
  automation: 'Automation',
  commerce: 'Catalog',
  team: 'Team',
  settings: 'Settings',
};

export default function App() {
  const { agent, loading, isAdmin, isManager } = useAuth();
  const { activeChat, activeChatId, selectChat, searchQuery, setSearchQuery } = useChat();

  const [currentView, setCurrentView] = useState('inbox');
  const [resetToken, setResetToken] = useState(() =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('reset') || ''
      : ''
  );
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isCommerceModalOpen, setIsCommerceModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > 1080 : true
  );
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const searchInputRef = useRef(null);

  // Keyboard shortcut Cmd+K / Ctrl+K focuses top workspace search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <div className="app-loading-spinner" />
          <span className="app-loading-title">Loading TeamBee...</span>
          <span className="app-loading-subtitle">TEAM INBOX, IN SYNC</span>
        </div>
      </div>
    );
  }

  if (!agent) {
    if (resetToken) {
      return (
        <ResetPasswordView
          token={resetToken}
          onDone={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setResetToken('');
          }}
        />
      );
    }
    return <LoginView />;
  }

  const handleGlobalSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim() && currentView !== 'inbox' && currentView !== 'contacts') {
      setCurrentView('inbox');
    }
  };

  return (
    <div className="teambee-app-wrapper" data-node-id="2:2" data-name="Workspace Shell">
      <div className={`workspace-nav-container ${isMobileNavOpen ? 'mobile-open' : ''}`}>
        <WorkspaceSidebar
          currentView={currentView}
          onSelectView={setCurrentView}
          onOpenSettings={() => setCurrentView(isAdmin ? 'settings' : 'inbox')}
          onOpenSimulator={() => setCurrentView(isAdmin ? 'settings' : 'inbox')}
          onCloseMobile={() => setIsMobileNavOpen(false)}
        />
      </div>

      {isMobileNavOpen && (
        <div
          className="workspace-nav-mobile-backdrop"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      <main className="workspace-main" data-name="Workspace content">
        <header className="workspace-top-bar">
          <div className="top-bar-left">
            <button
              type="button"
              className="top-bar-mobile-menu-btn"
              onClick={() => setIsMobileNavOpen(true)}
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>

            <div className="top-bar-breadcrumbs">
              <span className="breadcrumb-muted">Workspace</span>
              <span className="breadcrumb-slash">/</span>
              <span className="breadcrumb-active">{VIEW_LABELS[currentView] || 'Inbox'}</span>
            </div>
          </div>

          <div className="top-bar-right">
            <div className="top-bar-search-box">
              <Search size={14} className="top-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search anything"
                className="top-search-input"
                value={searchQuery}
                onChange={handleGlobalSearchChange}
              />
              <span className="top-search-kbd">⌘ K</span>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="top-bar-icon-btn"
                onClick={() => setCurrentView('settings')}
                title="Channel setup & Sandbox simulator"
              >
                <HelpCircle size={18} />
              </button>
            )}
          </div>
        </header>

        {currentView === 'inbox' ? (
            <div
              className={`shared-inbox-card ${(activeChat || activeChatId) ? 'has-active-chat' : 'no-active-chat'}`}
              data-name="Shared inbox"
            >
              <ConversationList onOpenNewChat={() => setIsNewChatOpen(true)} />

              <div className="card-column-divider queue-divider" />

              <ChatCanvas
                onOpenTemplatePicker={() => setIsTemplateModalOpen(true)}
                onOpenCommercePicker={() => setIsCommerceModalOpen(true)}
                onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
                isSidebarOpen={isSidebarOpen}
                onBack={() => selectChat(null)}
              />

              {isSidebarOpen && activeChat && (
                <>
                  <div className="card-column-divider details-divider" />
                  <ContactSidebar onClose={() => setIsSidebarOpen(false)} />
                </>
              )}

              {isSidebarOpen && activeChat && (
                <div
                  className="crm-drawer-backdrop"
                  onClick={() => setIsSidebarOpen(false)}
                />
              )}
            </div>
        ) : currentView === 'overview' && isManager ? (
          <OverviewView onNavigateView={setCurrentView} />
        ) : currentView === 'contacts' ? (
          <ContactsView
            onOpenChatInInbox={() => setCurrentView('inbox')}
            onOpenNewChat={() => setIsNewChatOpen(true)}
          />
        ) : currentView === 'templates' ? (
          <TemplatesView
            onNavigateToBroadcasts={() => setCurrentView('broadcasts')}
          />
        ) : currentView === 'broadcasts' && isManager ? (
          <BroadcastsView />
        ) : currentView === 'automation' && isManager ? (
          <AutomationView />
        ) : currentView === 'commerce' && isManager ? (
          <CommerceView />
        ) : currentView === 'team' && isManager ? (
          <TeamView />
        ) : isAdmin ? (
          <SettingsView onNavigateView={setCurrentView} />
        ) : (
          <ContactsView
            onOpenChatInInbox={() => setCurrentView('inbox')}
            onOpenNewChat={() => setIsNewChatOpen(true)}
          />
        )}
      </main>

      <TemplateModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} />
      <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />
      <CommerceSendModal isOpen={isCommerceModalOpen} onClose={() => setIsCommerceModalOpen(false)} />
    </div>
  );
}
