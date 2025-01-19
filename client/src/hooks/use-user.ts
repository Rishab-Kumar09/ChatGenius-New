import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SelectUser } from "@db/schema";
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

// Always use relative URLs since we're serving from the same origin
const API_URL = '';

async function fetchUser(): Promise<SelectUser | null> {
  try {
    const response = await fetch('/api/user', {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}

export function useUser() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<SelectUser | null>({
    queryKey: ['/api/user'],
    queryFn: fetchUser,
    retry: 1,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const authMutation = useMutation({
    mutationFn: async (data: { 
      username: string; 
      password: string; 
      isLogin: boolean;
    }) => {
      try {
        const response = await fetch(`${API_URL}/api/${data.isLogin ? 'login' : 'register'}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            username: data.username,
            password: data.password,
            email: `${data.username}@example.com`,
            displayName: data.username
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Authentication failed');
        }

        const result = await response.json();
        
        // Immediately verify session
        const verifyResponse = await fetch(`${API_URL}/api/user`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!verifyResponse.ok) {
          throw new Error('Session verification failed');
        }

        await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
        setLocation('/');
        return result;
      } catch (error) {
        console.error('Auth error:', error);
        throw error;
      }
    }
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      toast({
        title: "Logging out...",
        description: "Ending your session",
      });

      const response = await fetch(`${API_URL}/api/logout`, {
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
      toast({
        title: "Logged out",
        description: "Successfully logged out",
      });
    },
    onError: (error) => {
      toast({
        title: "Logout failed",
        description: error.message || "Failed to log out",
        variant: "destructive",
      });
    }
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