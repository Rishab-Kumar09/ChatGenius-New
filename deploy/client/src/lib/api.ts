// Get base URL from environment or use relative path
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? process.env.VITE_API_URL || ''  // Empty string means same origin in production
  : 'http://localhost:3000';

// Get WebSocket URL from environment or construct it
const WS_BASE_URL = process.env.NODE_ENV === 'production'
  ? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host
  : 'ws://localhost:3000';

export const api = {
  // Base URLs
  baseUrl: API_BASE_URL,
  wsBaseUrl: WS_BASE_URL,

  // Helper to construct full URL
  url: (path: string) => `${API_BASE_URL}${path}`,
  
  // Helper to construct WebSocket URL
  wsUrl: (path: string) => `${WS_BASE_URL}${path}`,

  // Default fetch options
  defaultOptions: {
    credentials: 'include' as const,
    headers: {
      'Content-Type': 'application/json',
    },
  },

  // Generic fetch wrapper with error handling
  async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = api.url(path);
    const response = await fetch(url, {
      ...api.defaultOptions,
      ...options,
      headers: {
        ...api.defaultOptions.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || response.statusText);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },
}; 