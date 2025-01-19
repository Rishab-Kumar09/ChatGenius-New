import { useEffect, useState, useCallback } from 'react';
import type { Message, PresenceUpdate } from './types';

export function useWebSocket() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [presenceUpdates, setPresenceUpdates] = useState<Map<string, PresenceUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Use the /ws path to differentiate from Vite's WebSocket
    const wsUrl = import.meta.env.DEV 
      ? 'ws://localhost:5000/ws'
      : `ws://${window.location.host}/ws`;
      
    const websocket = new WebSocket(wsUrl);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket connected to', wsUrl);
      setIsConnected(true);
    };

    websocket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      setIsConnected(false);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (!data || !data.type) return;

        switch (data.type) {
          case 'new_message':
            if (data.message) {
              setMessages(prev => [...prev, data.message]);
            }
            break;
          case 'presence_update':
            if (data.userId) {
              setPresenceUpdates(prev => new Map(prev).set(data.userId, data));
            }
            break;
          case 'reaction_update':
            if (data.data?.messageId && data.data?.reactions) {
              setMessages(prev => {
                const messageId = data.data.messageId.toString();
                const index = prev.findIndex(msg => msg.id === messageId);
                if (index === -1) return prev;
                
                const newMessages = [...prev];
                newMessages[index] = { ...newMessages[index], reactions: data.data.reactions };
                return newMessages;
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  const sendReaction = useCallback((messageId: string, emoji: string, userId: number) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'reaction_update',
      messageId: parseInt(messageId),
      emoji,
      userId
    }));
  }, [ws]);

  return {
    messages,
    isConnected,
    presenceUpdates,
    sendReaction,
    ws
  };
}