import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SelectUser } from "@db/schema";
import { useLocation } from 'wouter';

async function fetchUser(): Promise<SelectUser | null> {
  const response = await fetch('/api/user', {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
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
  const [, setLocation] = useLocation();

  const { data: user, isLoading } = useQuery<SelectUser | null>({
    queryKey: ['/api/user'],
    queryFn: fetchUser,
    retry: false,
    staleTime: 0, // Set to 0 to always fetch fresh data when component mounts
  });

  const authMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; isLogin: boolean }) => {
      const response = await fetch(`/api/${data.isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          username: data.username,
          password: data.password
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      
      // Wait for the user query to complete before redirecting
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      const userData = await fetchUser();
      if (!userData) {
        throw new Error('Failed to fetch user data after login');
      }
      
      return result;
    },
    onSuccess: () => {
      setLocation('/'); // Redirect to home after successful auth
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Logout failed');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setLocation('/'); // Redirect to home after logout
    },
  });

  return {
    user,
    isLoading,
    login: (username: string, password: string) => 
      authMutation.mutate({ username, password, isLogin: true }),
    register: (username: string, password: string) =>
      authMutation.mutate({ username, password, isLogin: false }),
    logout: () => logoutMutation.mutate(),
    isPending: authMutation.isPending || logoutMutation.isPending,
  };
}