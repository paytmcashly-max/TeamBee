import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import LoginView from './components/auth/LoginView';
import ConversationList from './components/inbox/ConversationList';
import ChatCanvas from './components/inbox/ChatCanvas';
import ContactSidebar from './components/inbox/ContactSidebar';
import MetaOnboardingModal from './components/modals/MetaOnboardingModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useSocket } from './context/SocketContext';
import TemplateModal from './components/modals/TemplateModal';
import AgentManagementModal from './components/modals/AgentManagementModal';
import BroadcastModal from './components/modals/BroadcastModal';

export default function App() {
  const { agent, loading } = useAuth();
  const { activeChat, activeChatId, selectChat } = useChat();
  const { connected } = useSocket();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [isAgentsModalOpen, setIsAgentsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#090d16',
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
    <div className="app-container">
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
          onBack={() => selectChat(null)}
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
      <MetaOnboardingModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <TemplateModal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} />
      <BroadcastModal isOpen={isBroadcastModalOpen} onClose={() => setIsBroadcastModalOpen(false)} />
      <AgentManagementModal isOpen={isAgentsModalOpen} onClose={() => setIsAgentsModalOpen(false)} />
    </div>
    </ErrorBoundary>
  );
}
