export const defaultOptions: RequestInit = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Requested-With': 'XMLHttpRequest'
  },
};

export const baseURL = process.env.NODE_ENV === 'production' 
  ? process.env.VITE_API_URL || 'https://main.d2qm6cqq0orw0h.amplifyapp.com'
  : '';

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

  console.log('Making API request:', {
    url: `${baseURL}${endpoint}`,
    options: mergedOptions,
    environment: process.env.NODE_ENV,
    apiUrl: process.env.VITE_API_URL
  });

  const response = await fetch(`${baseURL}${endpoint}`, mergedOptions);
  
  if (!response.ok) {
    console.error('API request failed:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'An error occurred');
  }

  return response.json();
} 