import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from './use-toast';

export interface WebSocketMessage {
  type: string;
  messageId?: string;
  emoji?: string;
  userId?: number;
  data?: any;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastJsonMessage, setLastJsonMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      try {
        setLastJsonMessage(JSON.parse(event.data));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => ws.close();
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      toast({
        title: "Connection Error",
        description: "Lost connection to server. Please refresh the page.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const sendReaction = useCallback(async (messageId: string, emoji: string, userId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reaction_update',
        messageId,
        emoji,
        userId
      }));
    } else {
      toast({
        title: "Connection Error",
        description: "Lost connection to server. Please refresh the page.",
        variant: "destructive"
      });
    }
  }, [toast]);

  return { isConnected, lastJsonMessage, sendMessage, sendReaction };
} 