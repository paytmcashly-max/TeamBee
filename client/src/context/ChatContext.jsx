import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { token, agent, isAdmin } = useAuth();
  const { socket, joinChat, leaveChat } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagingWindow, setMessagingWindow] = useState({ isOpen: true, hoursRemaining: 24 });
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filters
  const [tabFilter, setTabFilter] = useState('mine'); // 'mine' | 'unassigned' | 'all'
  const [statusFilter, setStatusFilter] = useState('OPEN'); // 'OPEN' | 'UNASSIGNED' | 'RESOLVED' | 'ALL'
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState({});

  /**
   * Fetch chats from backend
   */
  const fetchChats = useCallback(async () => {
    if (!token) return;
    setLoadingChats(true);
    try {
      const params = new URLSearchParams({
        filter: tabFilter,
        status: statusFilter,
        search: searchQuery,
      });

      const res = await fetch(`/api/chats?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setChats(data.chats);
      }
    } catch (err) {
      console.error('Fetch chats error:', err);
    } finally {
      setLoadingChats(false);
    }
  }, [token, tabFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  /**
   * Fetch messages when activeChatId changes
   */
  const loadChat = useCallback(
    async (chatId) => {
      if (!chatId || !token) return;
      setLoadingMessages(true);

      // Join Socket.io room with RBAC guard
      await joinChat(chatId);

      try {
        const [chatRes, msgRes] = await Promise.all([
          fetch(`/api/chats/${chatId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/messages/${chatId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const chatData = await chatRes.json();
        const msgData = await msgRes.json();

        if (chatData.success) {
          setActiveChat(chatData.chat);
        }
        if (msgData.success) {
          setMessages(msgData.messages);
          setMessagingWindow(msgData.messagingWindow || { isOpen: true, hoursRemaining: 24 });
        }
      } catch (err) {
        console.error('Load chat error:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [token, joinChat]
  );

  const selectChat = (chatId) => {
    if (activeChatId && activeChatId !== chatId) {
      leaveChat(activeChatId);
    }
    setActiveChatId(chatId);
    loadChat(chatId);
  };

  /**
   * Real-time Socket.io event listeners
   */
  useEffect(() => {
    if (!socket) return;

    // Incoming new message (customer or agent)
    const handleNewMessage = ({ chatId, message }) => {
      // If belongs to currently open chat canvas, append immediately
      if (chatId === activeChatId) {
        setMessages((prev) => {
          // Avoid duplicate by id or waMessageId
          if (prev.some((m) => m.id === message.id || (m.waMessageId && m.waMessageId === message.waMessageId))) {
            return prev;
          }
          return [...prev, message];
        });
      }

      // Update previews in conversation list
      setChats((prev) => {
        const index = prev.findIndex((c) => c.id === chatId);
        if (index === -1) {
          fetchChats();
          return prev;
        }
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessagePreview: message.content || `[${message.messageType}]`,
          lastMessageAt: message.createdAt,
          unreadCount: chatId === activeChatId ? 0 : updated[index].unreadCount + 1,
        };
        // Sort newest on top
        return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
      });
    };

    // Message delivery status update (SENT -> DELIVERED -> READ)
    const handleStatusUpdate = ({ chatId, waMessageId, status }) => {
      if (chatId === activeChatId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.waMessageId === waMessageId) {
              return { ...m, status };
            }
            return m;
          })
        );
      }
    };

    // Chat assignment change
    const handleChatAssigned = ({ chatId, assignedAgentId, assignedAgentName, status }) => {
      setChats((prev) =>
        prev.map((c) => {
          if (c.id === chatId) {
            return {
              ...c,
              assignedAgentId,
              status,
              assignedAgent: assignedAgentName ? { name: assignedAgentName, id: assignedAgentId } : null,
            };
          }
          return c;
        })
      );
      if (activeChatId === chatId) {
        setActiveChat((prev) =>
          prev
            ? {
                ...prev,
                assignedAgentId,
                status,
                assignedAgent: assignedAgentName ? { name: assignedAgentName, id: assignedAgentId } : null,
              }
            : null
        );
      }
    };

    // Chat status changed (UNASSIGNED / OPEN / RESOLVED)
    const handleChatStatusChanged = ({ chatId, status }) => {
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, status } : c))
      );
      if (activeChatId === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, status } : null));
      }
    };

    // Agent typing indicator
    const handleAgentTyping = ({ chatId, agentName, isTyping }) => {
      if (chatId === activeChatId) {
        setTypingUsers((prev) => ({ ...prev, [agentName]: isTyping }));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_status_updated', handleStatusUpdate);
    socket.on('chat_assigned', handleChatAssigned);
    socket.on('chat_status_changed', handleChatStatusChanged);
    socket.on('agent_typing', handleAgentTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_status_updated', handleStatusUpdate);
      socket.off('chat_assigned', handleChatAssigned);
      socket.off('chat_status_changed', handleChatStatusChanged);
      socket.off('agent_typing', handleAgentTyping);
    };
  }, [socket, activeChatId, fetchChats]);

  /**
   * Send outbound message
   */
  const sendMessage = async (content, messageType = 'TEXT', mediaUrl = null, mediaFilename = null) => {
    if (!activeChatId || !token) return;

    const res = await fetch(`/api/messages/${activeChatId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
        messageType,
        mediaUrl,
        mediaFilename,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to send message');
    }
    return data;
  };

  /**
   * Assign chat to an agent or claim it
   */
  const assignChat = async (chatId, targetAgentId) => {
    if (!token) return;
    const res = await fetch(`/api/chats/${chatId}/assign`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ agentId: targetAgentId }),
    });
    const data = await res.json();
    if (data.success) {
      fetchChats();
      if (activeChatId === chatId) {
        setActiveChat(data.chat);
      }
    }
    return data;
  };

  /**
   * Update chat status (OPEN, RESOLVED, UNASSIGNED)
   */
  const updateChatStatus = async (chatId, status) => {
    if (!token) return;
    const res = await fetch(`/api/chats/${chatId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) {
      fetchChats();
      if (activeChatId === chatId) {
        setActiveChat(data.chat);
      }
    }
    return data;
  };

  /**
   * Update chat tags
   */
  const updateChatTags = async (chatId, tags) => {
    if (!token) return;
    const res = await fetch(`/api/chats/${chatId}/tags`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ tags }),
    });
    const data = await res.json();
    if (data.success && activeChat) {
      setActiveChat((prev) => ({ ...prev, tags: JSON.stringify(data.tags) }));
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, tags: JSON.stringify(data.tags) } : c))
      );
    }
    return data;
  };

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        activeChat,
        messages,
        messagingWindow,
        loadingChats,
        loadingMessages,
        tabFilter,
        setTabFilter,
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        typingUsers,
        selectChat,
        sendMessage,
        assignChat,
        updateChatStatus,
        updateChatTags,
        fetchChats,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
