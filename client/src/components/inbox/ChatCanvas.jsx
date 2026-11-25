import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { apiFetch } from '../../services/apiClient';
import ChatHeader from './ChatHeader';
import CareWindowBanner from './CareWindowBanner';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';

export default function ChatCanvas({
  onOpenTemplatePicker,
  onOpenCommercePicker,
  onToggleSidebar,
  isSidebarOpen,
  onBack,
}) {
  const { agent, isManager } = useAuth();
  const { emitTyping } = useSocket();
  const {
    activeChat,
    messages,
    loadingMessages,
    sendMessage,
    assignChat,
    updateChatStatus,
    snoozeChat,
    messagingWindow,
    typingUsers,
    replyToMessage,
    setReplyToMessage,
    messagePagination,
    loadOlderMessages,
  } = useChat();

  const [agentsList, setAgentsList] = useState([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesContainerRef = useRef(null);
  const previousChatIdRef = useRef(null);
  const previousLengthRef = useRef(0);

  useEffect(() => {
    if (!activeChat?.id) return;
    const isChatSwitch = previousChatIdRef.current !== activeChat.id;
    const isAppend = messages.length > previousLengthRef.current;

    if (messagesContainerRef.current && (isChatSwitch || isAppend)) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    previousChatIdRef.current = activeChat.id;
    previousLengthRef.current = messages.length;
  }, [activeChat?.id, messages.length, typingUsers]);

  useEffect(() => {
    let mounted = true;
    async function loadAgents() {
      try {
        const data = await apiFetch('/api/agents');
        if (mounted && data.agents) setAgentsList(data.agents);
      } catch {
        // Non-fatal if teammate list fails briefly.
      }
    }
    loadAgents();
    return () => {
      mounted = false;
    };
  }, []);

  if (!activeChat) {
    return (
      <div className="conversation-canvas empty-state">
        <div className="canvas-empty-card">
          <div className="canvas-empty-icon">
            <MessageSquare size={28} />
          </div>
          <h3>Select a conversation</h3>
          <p>Pick a thread from your queue or start a new WhatsApp message to begin collaborating.</p>
        </div>
      </div>
    );
  }

  const isExpired = messagingWindow ? !messagingWindow.isOpen : false;
  const hoursRemaining = messagingWindow ? messagingWindow.hoursRemaining : 24;
  const contactName = activeChat.contact?.name || activeChat.contact?.waId || 'WhatsApp User';

  const handleLoadOlder = async () => {
    setLoadingOlder(true);
    try {
      await loadOlderMessages();
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <div className="conversation-canvas" data-name="Conversation canvas">
      <ChatHeader
        chat={activeChat}
        currentAgent={agent}
        isAdmin={isManager}
        agentsList={agentsList}
        isSidebarOpen={isSidebarOpen}
        onBack={onBack}
        onToggleSidebar={onToggleSidebar}
        onAssign={(targetId) => assignChat(activeChat.id, targetId)}
        onSnooze={(untilIso) => snoozeChat(activeChat.id, untilIso)}
        onToggleResolve={() =>
          updateChatStatus(activeChat.id, activeChat.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED')
        }
      />

      <CareWindowBanner
        isExpired={isExpired}
        hoursRemaining={hoursRemaining}
        onOpenTemplatePicker={onOpenTemplatePicker}
      />

      <MessageList
        containerRef={messagesContainerRef}
        messages={messages}
        loadingMessages={loadingMessages}
        hasMore={Boolean(messagePagination?.hasMore)}
        loadingOlder={loadingOlder}
        onLoadOlder={handleLoadOlder}
        typingUsers={typingUsers}
        contactName={contactName}
        onReply={(msg) => setReplyToMessage(msg)}
      />

      <MessageComposer
        chatId={activeChat.id}
        isExpired={isExpired}
        replyToMessage={replyToMessage}
        onClearReply={() => setReplyToMessage(null)}
        onSendMessage={sendMessage}
        onOpenTemplatePicker={onOpenTemplatePicker}
        onOpenCommercePicker={onOpenCommercePicker}
        onTypingChange={emitTyping}
      />
    </div>
  );
}
