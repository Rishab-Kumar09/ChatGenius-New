import { useParams, useNavigate } from "wouter";
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
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DirectMessage() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      <div className="border-b p-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <UserAvatar user={recipientUser} className="h-10 w-10" interactive />
            <div>
              <h1 className="text-xl font-semibold">
                {recipientUser?.displayName || recipientUser?.username || 'Loading...'}
              </h1>
              {recipientUser?.status && (
                <p className="text-sm text-muted-foreground">{recipientUser.status}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-red-500/10"
            onClick={async () => {
              const confirmed = window.confirm("Are you sure you want to delete this conversation? This cannot be undone.");
              if (!confirmed) return;

              try {
                const response = await fetch(`/api/messages/conversation/${id}`, {
                  method: 'DELETE',
                });

                if (!response.ok) throw new Error('Failed to delete conversation');

                // Refetch conversations list
                queryClient.invalidateQueries({ queryKey: ['/api/messages/conversations'] });
                // Navigate back to home
                navigate('/');

                toast({
                  title: "Success",
                  description: "Conversation deleted successfully",
                });
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to delete conversation",
                  variant: "destructive"
                });
              }
            }}
          >
            <Trash2 className="h-5 w-5 text-red-500" />
          </Button>
        </div>
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
              />
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-background">
          <MessageInput 
            onSend={handleSendMessage}
            disabled={!currentUser}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </div>
      </div>
    </div>
  );
}