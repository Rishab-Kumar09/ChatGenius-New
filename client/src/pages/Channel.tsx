import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageInput } from "@/components/MessageInput";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/hooks/use-user";
import { useEffect, useRef, useState } from "react";
import { MessageThread } from "@/components/MessageThread";
import type { Message, Channel as ChannelType, User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { UserPlus, Lock, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSearch } from "@/hooks/useSearch";
import { SearchResults } from "@/components/SearchResults";
import { useEventSource } from "@/hooks/use-event-source";

interface ChannelWithStatus extends ChannelType {
  isMember: boolean;
  isPendingInvitation: boolean;
}

interface ChannelWithMembers extends ChannelType {
  members: Array<User & { role: string }>;
  isMember: boolean;
  isPendingInvitation: boolean;
}

interface SSEEvent {
  type: string;
  data: {
    action: string;
    channelId: number;
    userId: number;
  };
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
  const { lastEvent, isConnected } = useEventSource();
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);

  // Fetch channel details
  const { data: channel } = useQuery<ChannelWithMembers>({
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

  const handleSendMessage = async (content: string, file?: File) => {
    try {
      if (!isMember) {
        throw new Error('You must be a member of this channel to send messages');
      }

      // Check if replying to Sarah's message
      let messageContent = content;
      if (replyingTo?.sender.username === 'ai-assistant') {
        messageContent = `@sarah ${content}`;
      }

      const formData = new FormData();
      if (messageContent.trim()) {
        formData.append('content', messageContent);
      }
      formData.append('channelId', channelId!);
      if (replyingTo?.id) {
        formData.append('parentId', replyingTo.id.toString());
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

      // Clear reply state after successful send
      setReplyingTo(null);

      // Refetch messages
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/messages?channelId=${channelId}`] 
      });

      // Refetch channels to update membership status
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/channels'] 
      });
      
      // Also refetch channel details to update member count
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/channels/${channelId}`] 
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

      console.log('🎯 Adding reaction:', { messageId, emoji, user });
      
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
      // Also refetch channel details to update member count
      await queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}`] });

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

  // Listen for member count updates
  useEffect(() => {
    if (lastEvent?.type === 'channel' && 
        lastEvent.data.channelId === parseInt(channelId!, 10) && 
        (lastEvent.data.action === 'member_joined' || lastEvent.data.action === 'member_left')) {
      // Refetch channel details when membership changes
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}`] });
    }
  }, [lastEvent, channelId, queryClient]);

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

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Optimistically update the UI
      queryClient.setQueryData<Message[]>(['/api/messages', channelId], (old) => {
        if (!old) return [];
        return old.filter(message => message.id.toString() !== messageId);
      });

    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">#{channel.name}</h1>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {channel.isPrivate && (
                  <>
                    <span>•</span>
                    <Lock className="h-3.5 w-3.5" />
                    <span>Private</span>
                  </>
                )}
              </div>
            </div>
            {channel.description && (
              <p className="text-sm text-muted-foreground mt-1">{channel.description}</p>
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

      <div className="flex-1 relative">
        {!isMember ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Join this channel to view messages
          </div>
        ) : (
          <>
            <div className="absolute inset-0 overflow-y-auto">
              <div className="min-h-full">
                <div className="p-4 pb-[76px]">
                  <MessageThread 
                    messages={messages}
                    currentUserId={user?.id.toString() || ''}
                    onReply={handleReply}
                    replyingTo={replyingTo}
                    onReaction={handleReaction}
                    onDelete={handleDeleteMessage}
                  />
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-background">
              <MessageInput 
                channelId={channelId}
                placeholder="Type a message..."
                parentId={replyingTo?.id}
                onReplyComplete={() => setReplyingTo(null)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Channel;