import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageInput } from "@/components/MessageInput";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/hooks/use-user";
import { useEffect, useRef, useState } from "react";
import { MessageThread } from "@/components/MessageThread";
import type { Message, Channel as ChannelType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSearch } from "@/hooks/useSearch";
import { SearchResults } from "@/components/SearchResults";
import { useWebSocket } from "../hooks/use-websocket";

interface ChannelWithStatus extends ChannelType {
  isMember: boolean;
  isPendingInvitation: boolean;
}

export function Channel() {
  const [, params] = useRoute('/channel/:id');
  const channelId = params?.id;
  const { user } = useUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { query: inviteQuery, setQuery: setInviteQuery, results: searchResults } = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { sendMessage, isConnected } = useWebSocket();

  // Fetch channel details
  const { data: channel } = useQuery<ChannelType>({
    queryKey: [`/api/channels/${channelId}`],
    enabled: !!channelId,
  });

  // Fetch channel membership status
  const { data: channels = [] } = useQuery<ChannelWithStatus[]>({
    queryKey: ['/api/channels'],
    enabled: !!user,
  });

  const currentChannel = channelId ? channels.find(c => c.id === parseInt(channelId, 10)) : undefined;
  const isMember = currentChannel?.isMember;

  // Fetch messages
  const { data: messages = [], error: messagesError } = useQuery<Message[]>({
    queryKey: [`/api/messages?channelId=${channelId}`],
    enabled: !!channelId && !!isMember,
    refetchInterval: 3000
  });

  const handleSendMessage = async (content: string) => {
    try {
      if (!isMember) {
        throw new Error('You must be a member of this channel to send messages');
      }

      console.log('Sending message:', { content, channelId, parentId: replyingTo?.id });
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          channelId: parseInt(channelId!, 10),
          parentId: replyingTo?.id ? parseInt(replyingTo.id, 10) : null
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      // Clear reply state after successful send
      setReplyingTo(null);

      // Refetch messages
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/messages?channelId=${channelId}`] 
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Handle reply to message
  const handleReply = (message: Message) => {
    if (!isMember) {
      toast({
        title: "Error",
        description: "You must be a member of this channel to reply to messages",
        variant: "destructive",
      });
      return;
    }
    console.log('Replying to message:', message);
    setReplyingTo(message);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      if (!user) {
        console.error('❌ Missing required data:', { user });
        toast({
          title: "Cannot Add Reaction",
          description: "Please make sure you're logged in.",
          variant: "destructive"
        });
        throw new Error('No current user');
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

      console.log('🎯 Adding reaction:', { messageId, emoji, user });
      
      // Send reaction through WebSocket
      sendMessage({
        type: 'reaction_update',
        messageId,
        emoji,
        userId: user.id
      });
      
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

  const handleJoinChannel = async () => {
    try {
      const response = await fetch(`/api/channels/${channelId}/join`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join channel');
      }

      // Refetch channels to update membership status
      await queryClient.invalidateQueries({ queryKey: ['/api/channels'] });

      toast({
        title: "Success",
        description: "You have joined the channel",
      });
    } catch (error) {
      console.error('Error joining channel:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join channel",
        variant: "destructive",
      });
    }
  };

  const handleInviteUser = async (userId: string | number) => {
    try {
      // Send the invitation
      const response = await fetch(`/api/channels/${channelId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteeId: userId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send invitation');
      }

      toast({
        title: "Invitation sent",
        description: `Invitation sent successfully`,
      });

      setInviteQuery("");
      setIsInviteDialogOpen(false);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to invite user",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!channel) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">#{channel.name}</h1>
            {channel.description && (
              <p className="text-sm text-muted-foreground">{channel.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            {!isMember && (
              <Button onClick={handleJoinChannel}>
                Join Channel
              </Button>
            )}
            {isMember && (
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite to #{channel.name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <Input
                      placeholder="Search users..."
                      value={inviteQuery}
                      onChange={(e) => setInviteQuery(e.target.value)}
                    />
                    <div className="max-h-[300px] overflow-y-auto">
                      <SearchResults
                        query={inviteQuery}
                        users={searchResults.users}
                        channels={[]}
                        messages={[]}
                        onSelect={(type: 'dm' | 'channel' | 'message', id: string | number) => {
                          if (type === 'dm') {
                            handleInviteUser(id);
                          }
                        }}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isMember ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Join this channel to view messages
          </div>
        ) : (
          <>
            <MessageThread 
              messages={messages}
              currentUserId={user?.id.toString() || ''}
              onReply={handleReply}
              replyingTo={replyingTo}
              onReaction={handleReaction}
            />

            <MessageInput 
              onSend={handleSendMessage} 
              disabled={!user || !isMember}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default Channel;