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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const WS_URL = process.env.VITE_WS_URL || 'ws://localhost:3000';
    const wsUrl = import.meta.env.PROD
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : `${WS_URL}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected, attempting to reconnect...');
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to chat server. Retrying...",
        variant: "destructive"
      });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastJsonMessage(message);
        
        // Handle error messages
        if (message.type === 'error') {
          toast({
            title: "Error",
            description: message.data?.message || "An error occurred",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws.close();
    };
  }, [toast]);

  useEffect(() => {
    const cleanup = connect();
    return () => cleanup?.();
  }, [connect]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast({
        title: "Not Connected",
        description: "Unable to send message: Not connected to chat server",
        variant: "destructive"
      });
      return;
    }

    try {
      wsRef.current.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Send Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  }, [toast]);

  return { isConnected, lastJsonMessage, sendMessage };
} 