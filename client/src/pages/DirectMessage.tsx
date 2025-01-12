import { useParams } from "wouter";
import { MessageInput } from "@/components/MessageInput";
import { UserAvatar } from "@/components/UserAvatar";
import { useWebSocket } from "@/lib/useWebSocket";
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

export function DirectMessage() {
  const { id } = useParams();
  const { messages: wsMessages, isConnected, presenceUpdates, sendReaction } = useWebSocket();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const queryClient = useQueryClient();

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
  const allMessages = [...messages, ...wsMessages.filter(m => m.dmId === id || m.recipientId === id)];

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
        queryKey: [`/api/messages?recipientId=${id}`]
      });

      // Invalidate conversations to update sidebar
      await queryClient.invalidateQueries({
        queryKey: ['/api/messages/conversations']
      });
      
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

      if (!isConnected) {
        console.error('❌ WebSocket not connected');
        toast({
          title: "Connection Error",
          description: "Lost connection to server. Please refresh the page.",
          variant: "destructive"
        });
        throw new Error('WebSocket not connected');
      }

      console.log('🎯 Adding reaction:', { messageId, emoji, currentUser });
      
      // Send reaction through WebSocket
      await sendReaction(messageId, emoji, currentUser.id);
      
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

  if (!recipientUser) {
    return null;
  }

  // Get user status from presence updates
  const userStatus = recipientUser ? presenceUpdates.get(recipientUser.id.toString())?.status || 'offline' : 'offline';

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <UserAvatar user={recipientUser} className="h-8 w-8" interactive />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{recipientUser.displayName || recipientUser.username}</h1>
              <Circle 
                className={cn(
                  "h-3 w-3",
                  userStatus === 'online' && "fill-green-500 text-green-500",
                  userStatus === 'busy' && "fill-yellow-500 text-yellow-500",
                  userStatus === 'offline' && "fill-red-500 text-red-500"
                )} 
              />
              <span className="text-sm text-muted-foreground capitalize">{userStatus}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {recipientUser.aboutMe || 'No status set'}
            </p>
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 px-6">
        <MessageThread 
          messages={allMessages} 
          currentUserId={currentUser?.id?.toString() || ''} 
          onReaction={handleReaction}
          onReply={handleReply}
          replyingTo={replyingTo}
        />
      </ScrollArea>
      <div className="p-4 border-t">
        <MessageInput 
          onSend={handleSendMessage} 
          disabled={!currentUser}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>
    </div>
  );
}