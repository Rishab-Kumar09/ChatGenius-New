import { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, Send } from 'lucide-react';

interface MessageInputProps {
  channelId?: string;
  recipientId?: string;
  parentId?: string;
  onReplyComplete?: () => void;
  placeholder?: string;
}

export function MessageInput({ 
  channelId, 
  recipientId, 
  parentId,
  onReplyComplete,
  placeholder = "Type a message..."
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !fileInputRef.current?.files?.length) return;

    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append('content', content);
      if (channelId) formData.append('channelId', channelId);
      if (recipientId) formData.append('recipientId', recipientId);
      if (parentId) formData.append('parentId', parentId);
      
      if (fileInputRef.current?.files?.length) {
        formData.append('file', fileInputRef.current.files[0]);
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setContent("");
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Invalidate queries to refresh the messages
      if (channelId) {
        queryClient.invalidateQueries({ queryKey: [`/api/messages?channelId=${channelId}`] });
      } else if (recipientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/messages?recipientId=${recipientId}`] });
      }

      if (parentId) {
        onReplyComplete?.();
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2 items-end">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={() => {
          // Trigger form submission when file is selected
          if (fileInputRef.current?.files?.length) {
            handleSubmit(new Event('submit') as any);
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip className="h-5 w-5" />
      </Button>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className="min-h-[60px] flex-1 resize-none"
      />
      <Button type="submit" size="icon" disabled={isLoading || (!content.trim() && !fileInputRef.current?.files?.length)}>
        <Send className="h-5 w-5" />
      </Button>
    </form>
  );
}