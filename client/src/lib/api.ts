const API_CONFIG = {
  production: 'https://main.d2qm6cqq0orw0h.amplifyapp.com',
  development: ''
} as const;

export const defaultOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

export const baseURL = process.env.NODE_ENV === 'production' 
  ? process.env.VITE_API_URL || API_CONFIG.production
  : API_CONFIG.development;

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  const response = await fetch(`${baseURL}${endpoint}`, mergedOptions);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  return response.json();
} 