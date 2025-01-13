import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SelectUser } from "@db/schema";
import { useLocation } from 'wouter';

async function fetchUser(): Promise<SelectUser | null> {
  const response = await fetch('/api/user', {
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null;
    }

    if (response.status >= 500) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    throw new Error(`${response.status}: ${await response.text()}`);
  }

  return response.json();
}

export function useUser() {
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  const { data: user, isLoading, error } = useQuery<SelectUser | null>({
    queryKey: ['/api/users/me'],
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) {
        if (res.status === 401) {
          // Check if we're not already on the login page to avoid infinite redirects
          const currentPath = window.location.hash.slice(1);
          if (currentPath !== '/login') {
            navigate('/login');
          }
          throw new Error('Not authenticated');
        }
        throw new Error('Failed to fetch user');
      }
      return res.json();
    },
  });

  const authMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; isLogin: boolean }) => {
      const response = await fetch(`/api/${data.isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      navigate('/'); // Redirect to home after successful auth
      window.location.reload(); // Refresh the page after login
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      navigate('/'); // Redirect to home after logout
    },
  });

  return {
    user,
    isLoading,
    error,
    login: (username: string, password: string) => 
      authMutation.mutate({ username, password, isLogin: true }),
    register: (username: string, password: string) =>
      authMutation.mutate({ username, password, isLogin: false }),
    logout: () => logoutMutation.mutate(),
    isPending: authMutation.isPending || logoutMutation.isPending,
  };
}