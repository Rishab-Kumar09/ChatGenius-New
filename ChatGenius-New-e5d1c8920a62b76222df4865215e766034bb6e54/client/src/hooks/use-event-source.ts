import { useEffect, useState, useRef } from 'react';
import { useUser } from './use-user';
import { useToast } from './use-toast';

interface SSEEvent {
  type: string;
  data: any;
}

export function useEventSource() {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();
  const errorToastRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);
  const errorStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;

    const connect = () => {
      if (eventSource?.readyState === EventSource.OPEN) {
        return;
      }

      // Only try to connect if we have a user
      if (!user) {
        setIsConnected(false);
        return;
      }

      if (eventSource) {
        eventSource.close();
      }

      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        errorStartTimeRef.current = null;
        // Clear any error toast if connection is successful
        if (errorToastRef.current) {
          clearTimeout(errorToastRef.current);
          errorToastRef.current = undefined;
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsConnected(false);
        eventSource?.close();
        
        // Start tracking error time if not already tracking
        if (!errorStartTimeRef.current) {
          errorStartTimeRef.current = Date.now();
        }
        
        reconnectAttempts.current++;
        
        // Only show error toast if error persists for more than 5 seconds
        if (errorToastRef.current) {
          clearTimeout(errorToastRef.current);
        }
        
        const errorDuration = Date.now() - (errorStartTimeRef.current || 0);
        if (errorDuration >= 5000) {
          errorToastRef.current = setTimeout(() => {
            toast({
              title: "Connection Error",
              description: "Failed to connect to chat server. Retrying...",
              variant: "destructive"
            });
          }, 100); // Small delay to prevent immediate toast
        }
        
        // Try to reconnect after delay (increases with attempts)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);
        retryTimeout = setTimeout(connect, delay);
      };

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'message', data });
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      });

      eventSource.addEventListener('reaction_update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'reaction_update', data });
        } catch (error) {
          console.error('Failed to parse reaction update:', error);
        }
      });

      eventSource.addEventListener('presence', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'presence', data });
        } catch (error) {
          console.error('Failed to parse presence update:', error);
        }
      });

      eventSource.addEventListener('channel', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'channel', data });
        } catch (error) {
          console.error('Failed to parse channel update:', error);
        }
      });

      eventSource.addEventListener('typing', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'typing', data });
        } catch (error) {
          console.error('Failed to parse typing update:', error);
        }
      });

      eventSource.addEventListener('profile_update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'profile_update', data });
        } catch (error) {
          console.error('Failed to parse profile update:', error);
        }
      });

      eventSource.addEventListener('message_deleted', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'message_deleted', data });
        } catch (error) {
          console.error('Failed to parse message deletion:', error);
        }
      });

      eventSource.addEventListener('conversation_update', (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent({ type: 'conversation_update', data });
        } catch (error) {
          console.error('Failed to parse conversation update:', error);
        }
      });
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (errorToastRef.current) {
        clearTimeout(errorToastRef.current);
      }
    };
  }, [user, toast]);

  return { lastEvent, isConnected };
} 