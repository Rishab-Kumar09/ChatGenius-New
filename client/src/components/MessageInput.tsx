import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, Send, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';

interface MessageInputProps {
  channelId?: string;
  recipientId?: string;
  parentId?: string;
  onReplyComplete?: () => void;
  placeholder?: string;
  onSend?: (content: string) => Promise<void>;
}

interface User {
  id: number;
  username: string;
  displayName: string | null;
}

interface Message {
  id: string;
  content: string;
  sender: {
    id: number;
    username: string;
    displayName: string | null;
  };
  timestamp: string;
}

export function MessageInput({ 
  channelId, 
  recipientId, 
  parentId,
  onReplyComplete,
  placeholder = "Type a message...",
  onSend
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch the parent message if we're replying
  const { data: parentMessage } = useQuery<Message>({
    queryKey: ['message', parentId],
    queryFn: async () => {
      if (!parentId) return null;
      const response = await fetch(`/api/messages/${parentId}`);
      if (!response.ok) throw new Error('Failed to fetch message');
      return response.json();
    },
    enabled: !!parentId
  });

  // Focus textarea when replying to a message
  useEffect(() => {
    if (parentId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [parentId]);

  const handleMentionSearch = useCallback(async (search: string) => {
    try {
      const response = await fetch(`/api/search?type=users&query=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setMentionResults(data.users);
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  }, []);

  const insertMention = useCallback((user: User) => {
    const beforeCursor = content.substring(0, cursorPosition);
    const afterCursor = content.substring(cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    const newContent = beforeCursor.substring(0, lastAtIndex) + 
      `@${user.displayName || user.username} ` + 
      afterCursor;
    
    setContent(newContent);
    setShowMentions(false);
    setMentionResults([]);
    
    // Set focus back to textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
      const newCursorPos = lastAtIndex + (user.displayName || user.username).length + 2;
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  }, [content, cursorPosition]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setCursorPosition(e.target.selectionStart);

    // Check for mention
    const beforeCursor = newContent.substring(0, e.target.selectionStart);
    const match = beforeCursor.match(/@(\w*)$/);
    
    if (match) {
      setMentionSearch(match[1]);
      setShowMentions(true);
      handleMentionSearch(match[1]);
    } else {
      setShowMentions(false);
      setMentionResults([]);
    }
  }, [handleMentionSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !fileInputRef.current?.files?.length) return;

    try {
      setIsLoading(true);

      if (onSend) {
        await onSend(content);
        setContent("");
        return;
      }

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
    <form onSubmit={handleSubmit} className="p-4 border-t flex flex-col gap-2">
      {/* Reply Preview */}
      {parentMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">
              Replying to {parentMessage.sender.displayName || parentMessage.sender.username}
            </div>
            <div className="text-sm truncate">{parentMessage.content}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              onReplyComplete?.();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={() => {
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
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="min-h-[60px] resize-none"
          />
          
          {/* Mention suggestions */}
          {showMentions && mentionResults.length > 0 && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-background border rounded-lg shadow-lg overflow-hidden">
              {mentionResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                  onClick={() => insertMention(user)}
                >
                  <span className="font-medium">{user.displayName || user.username}</span>
                  {user.displayName && (
                    <span className="text-sm text-muted-foreground">@{user.username}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" size="icon" disabled={isLoading || (!content.trim() && !fileInputRef.current?.files?.length)}>
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}