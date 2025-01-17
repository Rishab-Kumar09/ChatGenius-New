import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SelectUser } from "@db/schema";
import { useLocation } from 'wouter';

async function fetchUser(): Promise<SelectUser | null> {
  try {
    const response = await fetch('/api/user', {
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error(`${response.status}: ${await response.text()}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export function useUser() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useQuery<SelectUser | null>({
    queryKey: ['/api/user'],
    queryFn: fetchUser,
    retry: false,
    staleTime: 0,
  });

  const authMutation = useMutation({
    mutationFn: async (data: { 
      username: string; 
      password: string; 
      email?: string;
      displayName?: string;
      isLogin: boolean;
    }) => {
      try {
        console.log('Attempting auth:', data.isLogin ? 'login' : 'register');
        const response = await fetch(`/api/${data.isLogin ? 'login' : 'register'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include',
        });

        const responseText = await response.text();
        console.log('Auth response:', response.status, responseText);

        if (!response.ok) {
          throw new Error(responseText || 'Authentication failed');
        }

        try {
          return JSON.parse(responseText);
        } catch {
          return responseText;
        }
      } catch (error) {
        console.error('Auth error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Auth success:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setLocation('/');
      window.location.reload();
    },
    onError: (error) => {
      console.error('Auth mutation error:', error);
    }
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
      setLocation('/');
    },
  });

  return {
    user,
    isLoading,
    login: (username: string, password: string) => 
      authMutation.mutate({ username, password, isLogin: true }),
    register: (username: string, password: string, email?: string, displayName?: string) =>
      authMutation.mutate({ 
        username, 
        password, 
        email: email || `${username}@example.com`,
        displayName: displayName || username,
        isLogin: false 
      }),
    logout: () => logoutMutation.mutate(),
    isPending: authMutation.isPending || logoutMutation.isPending,
  };
}