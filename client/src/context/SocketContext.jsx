import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { resolveApiBaseUrl } from '../services/apiClient';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, agent } = useAuth();
  const [connected, setConnected] = useState(false);
  const [activeChatRoom, setActiveChatRoom] = useState(null);
  const [onlineAgentIds, setOnlineAgentIds] = useState([]);
  const socketRef = useRef(null);
  const activeChatRoomRef = useRef(null);

  useEffect(() => {
    activeChatRoomRef.current = activeChatRoom;
  }, [activeChatRoom]);

  useEffect(() => {
    if (!agent) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      setOnlineAgentIds([]);
      activeChatRoomRef.current = null;
      setActiveChatRoom(null);
      return;
    }

    const baseUrl = resolveApiBaseUrl();
    const socketUrl = baseUrl || '/';
    const socket = io(socketUrl, {
      auth: token ? { token } : undefined,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const chatId = activeChatRoomRef.current;
      if (chatId) {
        socket.emit('join_chat', { chatId }, (ack) => {
          if (!ack?.success && activeChatRoomRef.current === chatId) {
            activeChatRoomRef.current = null;
            setActiveChatRoom(null);
          }
        });
      }
    });

    socket.on('tenant_presence_snapshot', ({ onlineAgentIds: ids } = {}) => {
      if (Array.isArray(ids)) setOnlineAgentIds(ids);
    });

    socket.on('agent_presence_changed', ({ onlineAgentIds: ids } = {}) => {
      if (Array.isArray(ids)) setOnlineAgentIds(ids);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setOnlineAgentIds([]);
      activeChatRoomRef.current = null;
      setActiveChatRoom(null);
    };
  }, [token, agent?.id]);

  const joinChat = useCallback((chatId) => {
    return new Promise((resolve) => {
      activeChatRoomRef.current = chatId;
      if (!socketRef.current || !socketRef.current.connected) {
        return resolve({ success: false, reason: 'Socket not connected' });
      }

      socketRef.current.emit('join_chat', { chatId }, (ack) => {
        if (ack?.success) {
          setActiveChatRoom(chatId);
          resolve(ack);
        } else {
          if (activeChatRoomRef.current === chatId) activeChatRoomRef.current = null;
          resolve(ack || { success: false });
        }
      });
    });
  }, []);

  const leaveChat = useCallback((chatId) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_chat', { chatId });
      if (activeChatRoomRef.current === chatId) {
        activeChatRoomRef.current = null;
        setActiveChatRoom(null);
      }
    }
  }, []);

  const emitTyping = useCallback((chatId, isTyping) => {
    if (socketRef.current) {
      socketRef.current.emit('typing_indicator', { chatId, isTyping });
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        activeChatRoom,
        onlineAgentIds,
        joinChat,
        leaveChat,
        emitTyping,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
