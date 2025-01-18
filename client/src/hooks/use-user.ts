import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SelectUser } from "@db/schema";
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

// In production, use the current origin since we're serving from the same domain
const API_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin
  : '';

async function fetchUser(): Promise<SelectUser | null> {
  try {
    const response = await fetch(`${API_URL}/api/user`, {
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
  const { toast } = useToast();

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
      isLogin: boolean;
    }) => {
      try {
        toast({
          title: data.isLogin ? "Logging in..." : "Creating account...",
          description: `Attempting to ${data.isLogin ? 'login' : 'register'} as ${data.username}`,
        });

        console.log('Attempting auth:', data.isLogin ? 'login' : 'register');
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

        const responseText = await response.text();
        console.log('Auth response:', response.status, responseText);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
          toast({
            title: "Authentication failed",
            description: responseText || 'Failed to authenticate',
            variant: "destructive",
          });
          throw new Error(responseText || 'Authentication failed');
        }

        toast({
          title: "Authentication successful",
          description: `Successfully ${data.isLogin ? 'logged in' : 'registered'}!`,
        });

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
    onSuccess: async (data) => {
      console.log('Auth success:', data);
      toast({
        title: "Verifying session...",
        description: "Establishing secure connection",
      });
      
      // Wait a moment for the session to be established
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Multiple attempts to verify session
      let attempts = 0;
      const maxAttempts = 3;
      let lastResponseText = '';
      let lastResponseStatus = 0;
      
      while (attempts < maxAttempts) {
        try {
          toast({
            title: `Session verification attempt ${attempts + 1}/${maxAttempts}`,
            description: "Checking session status...",
          });

          const userResponse = await fetch(`${API_URL}/api/user`, {
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          lastResponseStatus = userResponse.status;
          lastResponseText = await userResponse.text();
          console.log(`Session verification attempt ${attempts + 1}:`, userResponse.status);
          console.log('Session verification response text:', lastResponseText);
          console.log('Session verification headers:', userResponse.headers);
          
          if (userResponse.ok) {
            console.log('Session verified');
            toast({
              title: "Session established",
              description: "Successfully connected!",
            });
            await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
            setLocation('/');
            return;
          }
          
          attempts++;
          if (attempts < maxAttempts) {
            toast({
              title: "Session verification failed",
              description: `Attempt ${attempts}/${maxAttempts} failed with status ${lastResponseStatus}. Server response: ${lastResponseText}. This usually means the session cookie was not accepted. Retrying...`,
              variant: "destructive",
              duration: 5000,
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error: any) {
          console.error('Session verification attempt failed:', error);
          attempts++;
          if (attempts < maxAttempts) {
            toast({
              title: "Session verification error",
              description: `Network or server error on attempt ${attempts}/${maxAttempts}: ${error.message}. Retrying...`,
              variant: "destructive",
              duration: 5000,
            });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      const cookieDebug = {
        allCookies: document.cookie,
        hasCookies: document.cookie.length > 0,
        hasSessionCookie: document.cookie.includes('connect.sid'),
        cookieEnabled: navigator.cookieEnabled,
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        host: window.location.host
      };

      console.log('Cookie debug info:', cookieDebug);
      
      const cookieError = document.cookie.includes('connect.sid') 
        ? `Session cookie is present but might be invalid or expired.
           Cookie debug:
           - All cookies: ${cookieDebug.allCookies}
           - Cookie length: ${cookieDebug.allCookies.length}
           - Session cookie found: Yes`
        : `Session cookie (connect.sid) is not present.
           Cookie debug:
           - Cookies enabled in browser: ${cookieDebug.cookieEnabled}
           - All cookies present: ${cookieDebug.allCookies}
           - Running in secure context: ${cookieDebug.isSecureContext}
           - Protocol: ${cookieDebug.protocol}
           - Host: ${cookieDebug.host}
           
           This usually means:
           1. Third-party cookies are blocked
           2. Browser security settings are preventing cookie storage
           3. The site's security context is preventing cookie setting`;
      
      toast({
        title: "Session verification failed",
        description: `Authentication succeeded but session verification failed after ${maxAttempts} attempts. 
          
          Server Response:
          - Status: ${lastResponseStatus}
          - Message: ${lastResponseText}
          
          Cookie Status:
          ${cookieError}
          
          Troubleshooting steps:
          1. Check browser cookie settings (Settings > Privacy > Cookies)
          2. Allow third-party cookies for this site
          3. Try using Chrome or Firefox if using Safari
          4. Clear browser cookies and try again
          5. Check if any privacy extensions are blocking cookies`,
        variant: "destructive",
        duration: 15000,
      });
      throw new Error(`Failed to establish session after ${maxAttempts} attempts. Cookie debug: ${JSON.stringify(cookieDebug)}`);
    },
    onError: (error) => {
      console.error('Auth mutation error:', error);
      const errorMessage = error.message || "An unexpected error occurred";
      let description = errorMessage;
      
      if (errorMessage.includes('Failed to establish session')) {
        const cookieDebug = {
          allCookies: document.cookie,
          hasCookies: document.cookie.length > 0,
          hasSessionCookie: document.cookie.includes('connect.sid'),
          cookieEnabled: navigator.cookieEnabled,
          isSecureContext: window.isSecureContext,
          protocol: window.location.protocol,
          host: window.location.host
        };

        description = `Login succeeded but session verification failed. 
          
          Technical details:
          - Initial login: Successful
          - Session verification: Failed
          - Browser cookie settings: ${navigator.cookieEnabled ? 'Enabled' : 'Disabled'}
          - Running in secure context: ${window.isSecureContext}
          - Protocol: ${window.location.protocol}
          - Host: ${window.location.host}
          - Cookies present: ${document.cookie.length > 0 ? 'Yes' : 'No'}
          - Session cookie found: ${document.cookie.includes('connect.sid') ? 'Yes' : 'No'}
          - All cookies: ${document.cookie || 'None'}
          
          Common solutions:
          1. Enable cookies in your browser settings
          2. Allow third-party cookies for this site
          3. Try a different browser (Chrome or Firefox recommended)
          4. Disable privacy/ad blockers temporarily
          5. Clear browser cookies and cache`;
      }
      
      toast({
        title: "Authentication error",
        description,
        variant: "destructive",
        duration: 15000,
      });
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