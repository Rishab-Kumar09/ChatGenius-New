import { useState } from 'react';
import { useToast } from './use-toast';

export function useAIChat() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const sendMessageToAI = async (content: string, channelId?: string) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          channelId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message to AI');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AI chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get AI response. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendMessageToAI,
    isLoading
  };
} 