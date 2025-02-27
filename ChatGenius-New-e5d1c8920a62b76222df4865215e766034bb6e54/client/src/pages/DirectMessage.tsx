import { useParams } from "wouter";
import { MessageInput } from "@/components/MessageInput";
import { UserAvatar } from "@/components/UserAvatar";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Message, User, ThreadMessage } from "@/lib/types";
import type { SelectUser } from "../../../db/schema";
import { Circle } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageThread } from "@/components/MessageThread";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useEventSource } from "@/hooks/use-event-source";
import { ReplyPreview } from "@/components/ReplyPreview";

export function DirectMessage() {
  const { id } = useParams();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const queryClient = useQueryClient();
  const { lastEvent } = useEventSource();
  const [presenceUpdates, setPresenceUpdates] = useState<Map<string, { status: string, lastSeen: string }>>(new Map());

  // Fetch recipient user data
  const { data: recipientUser } = useQuery<User>({
    queryKey: [`/api/users/${id}`],
    enabled: !!id,
  });

  // Fetch messages with React Query
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/messages', id],
    queryFn: async () => {
      const response = await fetch(`/api/messages?recipientId=${id}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!id && !!currentUser,
    refetchInterval: 3000 // Poll every 3 seconds
  });

  // Force refresh on login
  useEffect(() => {
    if (currentUser) {
      const hasRefreshed = sessionStorage.getItem('hasRefreshed');
      if (!hasRefreshed) {
        console.log('User logged in, refreshing data...');
        // Force refetch all relevant queries
        queryClient.invalidateQueries({ 
          queryKey: ['/api/messages/conversations'],
          refetchType: 'all'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/users'],
          refetchType: 'all'
        });
        if (id) {
          queryClient.invalidateQueries({ 
            queryKey: ['/api/messages', id],
            refetchType: 'all'
          });
          queryClient.invalidateQueries({ 
            queryKey: [`/api/users/${id}`],
            refetchType: 'all'
          });
        }
        sessionStorage.setItem('hasRefreshed', 'true');
      }
    }
  }, [currentUser, queryClient, id]);

  // Combine server messages with websocket messages
  const allMessages = messages;

  const handleSendMessage = async (content: string, file?: File) => {
    try {
      if (!id) {
        throw new Error('No recipient ID provided');
      }

      const formData = new FormData();
      if (content.trim()) {
        formData.append('content', content);
      }
      formData.append('recipientId', id);
      if (replyingTo?.id) {
        formData.append('parentId', replyingTo.id);
      }
      if (file) {
        formData.append('file', file);
        console.log('Appending file:', file.name, file.type, file.size);
      }

      const response = await fetch('/api/messages', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Failed to send message:', error);
        throw new Error('Failed to send message');
      }

      // Refetch messages
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/messages', id]
      });

      // Force an immediate refetch of conversations to update sidebar
      await queryClient.invalidateQueries({
        queryKey: ['/api/messages/conversations']
      });
      await queryClient.refetchQueries({
        queryKey: ['/api/messages/conversations'],
        type: 'active'
      });

      // Broadcast conversation update event
      const event = new CustomEvent('conversation_update', {
        detail: { recipientId: id }
      });
      window.dispatchEvent(event);
      
      // Clear reply state
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      if (!id || !currentUser) {
        console.error('❌ Missing required data:', { id, currentUser });
        toast({
          title: "Cannot Add Reaction",
          description: "Please make sure you're logged in.",
          variant: "destructive"
        });
        throw new Error('No recipient ID or current user');
      }

      console.log('🎯 Adding reaction:', { messageId, emoji, currentUser });
      
      // Send reaction through HTTP POST
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emoji })
      });

      if (!response.ok) {
        throw new Error('Failed to update reaction');
      }
      
      console.log('✅ Reaction sent successfully');

    } catch (error) {
      console.error('❌ Error sending reaction:', error);
      toast({
        title: "Error",
        description: error instanceof Error 
          ? `Failed to add reaction: ${error.message}` 
          : "Failed to add reaction. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleReply = useCallback((message: Message) => {
    // Convert Message to ThreadMessage if needed
    const threadMessage: ThreadMessage = 'replies' in message 
      ? message as ThreadMessage 
      : { ...message, replies: [], depth: 0 };
    setReplyingTo(threadMessage);
  }, []);

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Optimistically update the UI
      queryClient.setQueryData<Message[]>(['/api/messages', id], (old) => {
        if (!old) return [];
        return old.filter(message => message.id.toString() !== messageId);
      });

      // Invalidate conversations to update sidebar
      await queryClient.invalidateQueries({
        queryKey: ['/api/messages/conversations']
      });

    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  };

  // Handle SSE events
  useEffect(() => {
    if (lastEvent?.type === 'presence') {
      setPresenceUpdates(prev => {
        const newMap = new Map(prev);
        newMap.set(lastEvent.data.userId, {
          status: lastEvent.data.status,
          lastSeen: lastEvent.data.lastSeen
        });
        return newMap;
      });
    }
  }, [lastEvent]);

  if (!recipientUser) {
    return null;
  }

  // Get user status from presence updates
  const userStatus = recipientUser.username === 'ai-assistant' ? 'online' :
    presenceUpdates.get(recipientUser.id.toString())?.status || 'offline';

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserAvatar user={recipientUser} />
          <div>
            <h2 className="font-semibold">{recipientUser.displayName || recipientUser.username}</h2>
            <div className="flex items-center gap-2">
              <Circle className={cn(
                "h-2 w-2 fill-current",
                userStatus === 'online' && "text-green-500",
                userStatus === 'busy' && "text-yellow-500",
                userStatus === 'offline' && "text-red-500"
              )} />
              <p className="text-sm text-muted-foreground">{userStatus}</p>
            </div>
          </div>
        </div>
        {/* DocumentUpload component hidden but functionality preserved */}
      </div>

      <div className="flex-1 relative">
        <div className="absolute inset-0 overflow-y-auto">
          <div className="min-h-full">
            <div className="p-4 pb-[76px]">
              <MessageThread 
                messages={allMessages}
                currentUserId={currentUser?.id.toString() || ''}
                onReply={handleReply}
                replyingTo={replyingTo}
                onReaction={handleReaction}
                onDelete={handleDeleteMessage}
              />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-background">
          {replyingTo && (
            <ReplyPreview 
              message={replyingTo} 
              onCancel={() => setReplyingTo(null)} 
            />
          )}
          <MessageInput 
            recipientId={id}
            placeholder="Type a message..."
            parentId={replyingTo?.id}
            onReplyComplete={() => setReplyingTo(null)}
          />
        </div>
      </div>
    </div>
  );
}