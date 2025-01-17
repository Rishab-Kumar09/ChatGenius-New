import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from '@tanstack/react-query';
import { Send, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { FileUpload } from '@/components/FileUpload';

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

interface QueuedFile {
  file: File;
  status: 'queued' | 'sending' | 'sent' | 'error';
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
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
    if (!content.trim() && fileQueue.length === 0) return;

    try {
      setIsLoading(true);

      if (onSend) {
        await onSend(content);
        setContent("");
        return;
      }

      // If there are files in the queue, send them one by one
      if (fileQueue.length > 0) {
        for (let i = 0; i < fileQueue.length; i++) {
          const queuedFile = fileQueue[i];
          if (queuedFile.status === 'sent') continue;

          // Update file status to sending
          setFileQueue(prev => prev.map((f, index) => 
            index === i ? { ...f, status: 'sending' } : f
          ));

          const formData = new FormData();
          formData.append('content', content);
          if (channelId) formData.append('channelId', channelId);
          if (recipientId) formData.append('recipientId', recipientId);
          if (parentId) formData.append('parentId', parentId);
          formData.append('file', queuedFile.file);

          try {
            const response = await fetch('/api/messages', {
              method: 'POST',
              body: formData
            });

            if (!response.ok) {
              throw new Error('Failed to send message');
            }

            // Update file status to sent
            setFileQueue(prev => prev.map((f, index) => 
              index === i ? { ...f, status: 'sent' } : f
            ));
          } catch (error) {
            console.error('Failed to send file:', error);
            // Update file status to error
            setFileQueue(prev => prev.map((f, index) => 
              index === i ? { ...f, status: 'error' } : f
            ));
            throw error;
          }
        }

        // Clear sent files from queue
        setFileQueue(prev => prev.filter(f => f.status !== 'sent'));
      } else {
        // Send text-only message
        const formData = new FormData();
        formData.append('content', content);
        if (channelId) formData.append('channelId', channelId);
        if (recipientId) formData.append('recipientId', recipientId);
        if (parentId) formData.append('parentId', parentId);

        const response = await fetch('/api/messages', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }
      }

      setContent("");

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

  const handleFileSelect = (file: File) => {
    setFileQueue(prev => [...prev, { file, status: 'queued' }]);
  };

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

      {/* File Queue Preview */}
      {fileQueue.length > 0 && (
        <div className="px-3 py-2 bg-muted/50 rounded-lg">
          <div className="flex gap-2 overflow-x-auto">
            {fileQueue.map((queuedFile, index) => (
              <div key={index} className="relative group flex-shrink-0">
                {queuedFile.file.type.startsWith('image/') ? (
                  <div className="relative aspect-square w-[70px]">
                    <img
                      src={URL.createObjectURL(queuedFile.file)}
                      alt={queuedFile.file.name}
                      className="w-full h-full object-cover rounded-md"
                    />
                    {queuedFile.status === 'sending' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px]">
                        Sending...
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 p-0"
                      onClick={() => setFileQueue(prev => prev.filter((_, i) => i !== index))}
                    >
                      <X className="h-2 w-2 text-white" />
                    </Button>
                  </div>
                ) : (
                  <div className="aspect-square w-[70px] bg-background/50 rounded-md p-1.5 flex flex-col items-center justify-center relative">
                    <div className="text-[10px] text-center truncate w-full">{queuedFile.file.name}</div>
                    <div className="text-[8px] text-muted-foreground mt-0.5">
                      {(queuedFile.file.size / 1024).toFixed(1)} KB
                    </div>
                    {queuedFile.status === 'sending' && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px]">
                        Sending...
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 p-0"
                      onClick={() => setFileQueue(prev => prev.filter((_, i) => i !== index))}
                    >
                      <X className="h-2 w-2 text-white" />
                    </Button>
                  </div>
                )}
                {queuedFile.status === 'error' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-destructive-foreground text-[8px] p-0.5 text-center">
                    Failed
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {fileQueue.length} file{fileQueue.length !== 1 ? 's' : ''} selected
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <FileUpload onFileSelect={handleFileSelect} disabled={isLoading} />
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyPress}
            placeholder={fileQueue.length > 0 ? "Add a caption..." : placeholder}
            className="min-h-[2.5rem] max-h-32 resize-none"
            disabled={isLoading}
          />
          {showMentions && mentionResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-64 max-h-48 overflow-auto bg-background border rounded-md shadow-lg">
              {mentionResults.map(user => (
                <button
                  key={user.id}
                  className="w-full px-4 py-2 text-left hover:bg-muted/50 focus:bg-muted/50 focus:outline-none"
                  onClick={() => insertMention(user)}
                  type="button"
                >
                  {user.displayName || user.username}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button 
          type="submit" 
          size="icon"
          disabled={(!content.trim() && fileQueue.length === 0) || isLoading}
          className={cn(
            "h-9 w-9",
            isLoading && "animate-pulse"
          )}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}