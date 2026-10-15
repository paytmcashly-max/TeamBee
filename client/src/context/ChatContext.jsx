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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState({});

  // ⚡ Debounce search input by 300ms to eliminate network spam & spinner flicker
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Fetch chats from backend
   */
  const fetchChats = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoadingChats(true);
    try {
      const params = new URLSearchParams({
        filter: tabFilter,
        status: statusFilter,
        search: debouncedSearch,
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
      if (!silent) setLoadingChats(false);
    }
  }, [token, tabFilter, statusFilter, debouncedSearch]);

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
    setActiveChatId(chatId || null);
    if (chatId) {
      loadChat(chatId);
    } else {
      setActiveChat(null);
      setMessages([]);
    }
  };

  /**
   * Real-time Socket.io event listeners
   */
  useEffect(() => {
    if (!socket) return;

    // Incoming new message (customer or agent)
    const handleNewMessage = ({ chatId, message }) => {
      // Play pleasant sound chime for customer messages
      if (message.senderType === 'CUSTOMER' || message.direction === 'INBOUND') {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
          }
        } catch (e) {}
      }

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
          unreadCount: chatId === activeChatId ? 0 : (updated[index].unreadCount || 0) + 1,
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
   * Send outbound message or private note with flexible options
   */
  const sendMessage = async (content, options = 'TEXT', mediaUrl = null, mediaFilename = null) => {
    if (!activeChatId || !token) return;

    let payload = {
      content,
      messageType: 'TEXT',
      mediaUrl: null,
      mediaFilename: null,
      isInternal: false,
      buttons: null,
    };

    if (typeof options === 'string') {
      payload.messageType = options;
      payload.mediaUrl = mediaUrl;
      payload.mediaFilename = mediaFilename;
    } else if (typeof options === 'object' && options !== null) {
      payload.messageType = options.messageType || 'TEXT';
      payload.mediaUrl = options.mediaUrl || null;
      payload.mediaFilename = options.mediaFilename || null;
      payload.isInternal = !!options.isInternal;
      payload.buttons = options.buttons || null;
    }

    // ⚡ Instant Optimistic UI (0ms latency): Append bubble immediately with PENDING clock
    const tempId = `temp-${Date.now()}`;
    const targetChatId = activeChatId;
    const nowIso = new Date().toISOString();

    const optimisticMessage = {
      id: tempId,
      chatId: targetChatId,
      senderType: 'AGENT',
      direction: 'OUTBOUND',
      senderAgentId: agent?.id,
      senderAgent: agent ? { id: agent.id, name: agent.name } : null,
      messageType: payload.messageType,
      content: payload.content,
      mediaUrl: payload.mediaUrl,
      mediaFilename: payload.mediaFilename,
      buttons: payload.buttons ? (typeof payload.buttons === 'string' ? payload.buttons : JSON.stringify(payload.buttons)) : null,
      status: 'PENDING',
      isInternal: payload.isInternal,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Instant append in active chat
    setMessages((prev) => [...prev, optimisticMessage]);

    // Instant update in left conversation list
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === targetChatId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        lastMessagePreview: payload.content || `[${payload.messageType}]`,
        lastMessageAt: nowIso,
      };
      return copy.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    });

    try {
      const res = await fetch(`/api/messages/${targetChatId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED' } : m))
        );
        throw new Error(data.error || 'Failed to send message');
      }

      // Replace optimistic message with confirmed database record
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? data.message : m))
      );
      return data;
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED' } : m))
      );
      throw err;
    }
  };

  /**
   * Assign chat to an agent or claim it
   */
  const assignChat = async (chatId, targetAgentId) => {
    if (!token) return;
    // Optimistic update in state
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              assignedAgentId: targetAgentId,
              status: targetAgentId ? 'OPEN' : 'UNASSIGNED',
            }
          : c
      )
    );
    if (activeChatId === chatId) {
      setActiveChat((prev) =>
        prev
          ? {
              ...prev,
              assignedAgentId: targetAgentId,
              status: targetAgentId ? 'OPEN' : 'UNASSIGNED',
            }
          : null
      );
    }

    try {
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
        fetchChats(true);
        if (activeChatId === chatId) {
          setActiveChat(data.chat);
        }
      }
      return data;
    } catch (err) {
      fetchChats(true);
    }
  };

  /**
   * Update chat status (OPEN, RESOLVED, UNASSIGNED)
   */
  const updateChatStatus = async (chatId, status) => {
    if (!token) return;
    // Optimistic update in state
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, status } : c))
    );
    if (activeChatId === chatId) {
      setActiveChat((prev) => (prev ? { ...prev, status } : null));
    }

    try {
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
        fetchChats(true);
        if (activeChatId === chatId) {
          setActiveChat(data.chat);
        }
      }
      return data;
    } catch (err) {
      fetchChats(true);
    }
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

  /**
   * Update contact CRM details (name, email, customAttributes)
   */
  const updateContact = async (chatId, contactData) => {
    if (!token) return;
    const res = await fetch(`/api/chats/${chatId}/contact`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(contactData),
    });
    const data = await res.json();
    if (data.success && data.contact) {
      if (activeChatId === chatId) {
        setActiveChat((prev) => (prev ? { ...prev, contact: data.contact } : null));
      }
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, contact: data.contact } : c))
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
        updateContact,
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
