import { useState, useEffect, useCallback } from 'react';

interface EventSourceHookOptions {
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
}

export function useEventSource(url: string, options: EventSourceHookOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage?.(data);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      setConnected(false);
      setError(err);
      options.onError?.(err);
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [url, options.onMessage, options.onError]);

  return {
    connected,
    error
  };
}
