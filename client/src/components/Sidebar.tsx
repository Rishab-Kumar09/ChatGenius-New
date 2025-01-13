import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Hash, Plus, Trash2, Circle, Lock, Bell, LogOut } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { StatusSelector } from "./StatusSelector";
import { SearchBar } from "./SearchBar";
import { SearchResults } from "./SearchResults";
import { useUser } from "@/hooks/use-user";
import { useSearch } from "@/hooks/useSearch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SelectChannel } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useEventSource } from "@/lib/useEventSource";
import { useWebSocket } from "@/lib/useWebSocket";
import type { Channel } from "@/lib/types";

// Move interfaces to the top
interface ChannelFormData {
  channelName: string;
  isPublic: boolean;
}

// Import UI components after type definitions
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Conversation {
  userId: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  lastMessage: string | null;
  timestamp: string | null;
}

interface SearchBarProps {
  onSearch: (query: string) => void;
}

interface ChannelWithStatus extends Channel {
  isMember: boolean;
  isPendingInvitation: boolean;
}

interface ChannelInvitation {
  id: number;
  channelId: number;
  inviterId: number;
  inviteeId: number;
  status: string;
  channel: {
    id: number;
    name: string;
    description: string | null;
    isPrivate: boolean;
  };
  inviter: {
    id: number;
    username: string;
    displayName: string | null;
  };
}

export function Sidebar({ className }: { className?: string }) {
  const [, navigate] = useLocation();
  const { user: currentUser } = useUser();
  const [currentStatus, setCurrentStatus] = useState<'online' | 'busy' | 'offline'>('online');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<number | null>(null);
  const [channelToLeave, setChannelToLeave] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { query, setQuery, results, isLoading } = useSearch();
  const { messages: wsMessages, presenceUpdates } = useWebSocket();

  // Fetch channels
  const { data: channels = [] } = useQuery<ChannelWithStatus[]>({
    queryKey: ['/api/channels'],
    enabled: !!currentUser,
  });

  // Fetch conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/messages/conversations'],
    enabled: !!currentUser,
  });

  // Fetch pending invitations
  const { data: pendingInvitations = [] } = useQuery<ChannelInvitation[]>({
    queryKey: ['/api/channels/invitations'],
    queryFn: async () => {
      const response = await fetch('/api/channels/invitations', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }
      return response.json();
    },
    enabled: !!currentUser
  });

  // Refresh conversations when receiving WebSocket messages
  useEffect(() => {
    if (wsMessages.length > 0) {
      // Only refresh if the message is a DM
      const hasDM = wsMessages.some(msg => msg.recipientId || msg.dmId);
      if (hasDM) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/messages/conversations']
        });
      }
    }
  }, [wsMessages, queryClient]);

  // Connect to SSE for real-time updates
  useEventSource('/api/events', {
    onMessage: (data) => {
      if (data.type === 'channel') {
        // For all channel events, invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
        
        // If it's a deleted channel, handle navigation
        if (data.data.action === 'deleted') {
          const currentPath = window.location.pathname;
          if (currentPath === `/channel/${data.data.channelId}`) {
            navigate('/');
          }
        }
        
        // If it's an invitation event, refetch invitations
        if (data.data.action === 'invitation_created') {
          queryClient.invalidateQueries({ queryKey: ['/api/channels/invitations'] });
          // Show a toast notification for new invitations
          toast({
            title: "New Invitation",
            description: `You've been invited to join ${data.data.invitation.channel.name}`,
          });
        }
      }
    },
    onError: (error) => {
      console.error('SSE connection error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to real-time updates",
        variant: "destructive"
      });
    }
  });

  // Update presence status
  const updatePresenceStatus = async (status: 'online' | 'busy' | 'offline') => {
    if (currentUser) {
      try {
        const response = await fetch('/api/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        });

        if (!response.ok) {
          throw new Error('Failed to update status');
        }

        setCurrentStatus(status);
      } catch (error) {
        console.error('Failed to update presence:', error);
        toast({
          title: "Error",
          description: "Failed to update presence status",
          variant: "destructive"
        });
      }
    }
  };

  const form = useForm<ChannelFormData>({
    defaultValues: {
      channelName: "",
      isPublic: true,
    },
  });

  const handleCreateChannel = form.handleSubmit(async (data) => {
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: data.channelName,
          isPublic: data.isPublic
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const channel = await response.json();

      // Invalidate channels query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });

      toast({
        title: "Channel created",
        description: `Channel "${data.channelName}" has been created successfully.`,
      });

      // Reset form and close dialog
      form.reset();
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create channel",
        variant: "destructive"
      });
    }
  });

  const handleDeleteChannel = async (channelId: number) => {
    try {
      // Optimistically update the UI
      const previousChannels = queryClient.getQueryData<SelectChannel[]>(['/api/channels']);
      queryClient.setQueryData<SelectChannel[]>(['/api/channels'], (old) => {
        if (!old) return [];
        return old.filter(channel => channel.id !== channelId);
      });

      // Navigate to home if we're in the deleted channel
      const currentPath = window.location.pathname;
      if (currentPath === `/channel/${channelId}`) {
        navigate('/');
      }

      const response = await fetch(`/api/channels/${channelId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // If deletion fails, rollback the optimistic update
        queryClient.setQueryData(['/api/channels'], previousChannels);
        throw new Error(await response.text());
      }

      toast({
        title: "Channel deleted",
        description: "The channel has been deleted successfully."
      });

      // Clear the channelToDelete state
      setChannelToDelete(null);
    } catch (error) {
      console.error('Failed to delete channel:', error);
      toast({
        title: "Error",
        description: "Failed to delete channel",
        variant: "destructive"
      });
    }
  };

  const handleSearchSelect = (type: 'message' | 'channel' | 'dm', id: string | number) => {
    if (type === 'channel') {
      navigate(`/channel/${id}`);
    } else if (type === 'dm') {
      navigate(`/dm/${id}`);
    }
    setQuery(''); // Clear search after selection
  };

  // Handle invitation response
  const handleInvitationResponse = async (invitationId: number, action: 'accept' | 'reject') => {
    try {
      const response = await fetch(`/api/channels/invitations/${invitationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} invitation`);
      }

      // Refetch invitations and channels
      queryClient.invalidateQueries({ queryKey: ['/api/channels/invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });

      toast({
        title: `Invitation ${action}ed`,
        description: `You have ${action}ed the channel invitation.`
      });
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} invitation. Please try again.`,
        variant: "destructive"
      });
    }
  };

  const handleLeaveChannel = async (channelId: number) => {
    try {
      const response = await fetch(`/api/channels/${channelId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to leave channel');
      }

      // Refetch channels
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      setChannelToLeave(null);

      toast({
        title: "Left Channel",
        description: "You have successfully left the channel."
      });
    } catch (error) {
      console.error('Error leaving channel:', error);
      toast({
        title: "Error",
        description: "Failed to leave channel. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (!currentUser) return null;

  return (
    <div className={cn("flex flex-col h-full bg-[#1a1f36] text-white min-w-[280px]", className)}>
      {/* Search and Title section */}
      <div className="p-4">
        <h2 className="text-3xl font-extrabold mb-4 bg-gradient-to-b from-blue-300 to-blue-500 bg-clip-text text-transparent">
          Chat Genius
        </h2>
        <div className="relative">
          <SearchBar onSearch={setQuery} />
          {query && (
            <div className="absolute z-50 w-full mt-1 bg-[#1a1f36] border border-white/10 rounded-md shadow-lg">
              <SearchResults
                query={query}
                messages={results.messages}
                channels={results.channels}
                users={results.users}
                onSelect={handleSearchSelect}
                onClose={() => setQuery('')}
              />
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Scrollable content */}
      <div className="flex-1 px-4 overflow-x-hidden overflow-y-hidden hover:overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-blue-300/40 scrollbar-thin scrollbar-thumb-blue-300/40 scrollbar-track-transparent" style={{ 
        scrollbarGutter: 'stable',
        scrollbarColor: 'rgba(147, 197, 253, 0.4) transparent'
      } as React.CSSProperties}>
        {/* Channels section */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white/90">Channels</h2>
            <Button size="icon" variant="ghost" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {channels.map((channel) => (
            <div key={channel.id} className="group flex items-center">
              <Button
                variant="ghost"
                className="flex-1 justify-start mb-1 hover:bg-white/10 text-white/80 hover:text-white"
                onClick={() => navigate(`/channel/${channel.id}`)}
              >
                <Hash className="h-4 w-4 mr-2 opacity-70 flex-shrink-0" />
                <span className="truncate max-w-[140px]">{channel.name}</span>
                {channel.isPrivate && (
                  <Lock className="h-3.5 w-3.5 text-yellow-500/70 ml-2 flex-shrink-0" />
                )}
              </Button>
              {channel.role === 'owner' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-white/10"
                  onClick={() => setChannelToDelete(channel.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              ) : channel.role === 'member' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:bg-white/10"
                  onClick={() => setChannelToLeave(channel.id)}
                >
                  <LogOut className="h-4 w-4 text-red-400" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Separator className="bg-white/10 my-2" />

        {/* Direct Messages section */}
        <div className="py-4">
          <h2 className="text-lg font-semibold text-white/90 mb-2">Direct Messages</h2>
          {conversations.map((conversation) => {
            const userStatus = presenceUpdates.get(conversation.userId.toString())?.status || 'offline';
            return (
              <div key={conversation.userId} className="group flex items-center">
                <Button
                  variant="ghost"
                  className="flex-1 justify-start mb-1 hover:bg-white/10 text-white/80 hover:text-white"
                  onClick={() => {
                    if (conversation.userId) {
                      navigate(`/dm/${conversation.userId}`);
                    }
                  }}
                >
                  <UserAvatar
                    user={{
                      id: conversation.userId,
                      username: conversation.username,
                      displayName: conversation.displayName,
                      avatarUrl: conversation.avatarUrl
                    }}
                    className="h-6 w-6 mr-2"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">
                      {conversation.displayName || conversation.username}
                    </span>
                    <Circle 
                      className={cn(
                        "h-1.5 w-1.5 flex-shrink-0 mt-0.5",
                        userStatus === 'online' && "fill-green-500 text-green-500",
                        userStatus === 'busy' && "fill-yellow-500 text-yellow-500",
                        userStatus === 'offline' && "fill-red-500 text-red-500"
                      )} 
                    />
                  </div>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Invitations section */}
        <div className="py-4">
          <h2 className="text-lg font-semibold text-white/90 mb-2">Invitations</h2>
          {pendingInvitations.length > 0 ? (
            <div className="space-y-2">
              {pendingInvitations.map((invitation: ChannelInvitation) => (
                <div
                  key={invitation.id}
                  className="p-2 rounded-md border border-white/10 bg-[#151930]"
                >
                  <p className="text-sm mb-1">
                    <span className="font-medium">{invitation.inviter.displayName || invitation.inviter.username}</span>
                    {' invited you to join '}
                    <span className="font-medium">{invitation.channel.name}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleInvitationResponse(invitation.id, 'accept')}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover:bg-red-500/10 border-red-500/50 text-red-500 hover:text-red-600 hover:border-red-600"
                      onClick={() => handleInvitationResponse(invitation.id, 'reject')}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/50">No pending invitations</p>
          )}
        </div>
      </div>

      {/* User status section - Fixed at bottom */}
      <div className="sticky bottom-0 p-4 bg-[#151930] border-t border-white/10">
        <div className="flex items-center gap-2">
          <UserAvatar
            user={currentUser}
            className="h-8 w-8 ring-2 ring-white/10"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white/90">
              {currentUser.displayName || currentUser.username}
            </span>
            <StatusSelector
              currentStatus={currentStatus}
              onStatusChange={updatePresenceStatus}
              className="bg-white"
            />
          </div>
        </div>
      </div>

      {/* Delete Channel Confirmation Dialog */}
      <AlertDialog open={channelToDelete !== null} onOpenChange={(open) => !open && setChannelToDelete(null)}>
        <AlertDialogContent className="bg-[#1a1f36] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Channel</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Are you sure you want to delete this channel? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChannelToDelete(null)} className="bg-transparent text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => channelToDelete && handleDeleteChannel(channelToDelete)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Leave Channel Confirmation Dialog */}
      <AlertDialog open={channelToLeave !== null} onOpenChange={(open) => !open && setChannelToLeave(null)}>
        <AlertDialogContent className="bg-[#1a1f36] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Leave Channel</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Are you sure you want to leave this channel? You'll need a new invitation to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChannelToLeave(null)} className="bg-transparent text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => channelToLeave && handleLeaveChannel(channelToLeave)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Channel Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a1f36] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Create Channel</DialogTitle>
            <DialogDescription className="text-white/70">
              Create a new channel to start chatting with others.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateChannel} className="space-y-4">
            <div>
              <Label htmlFor="channelName" className="text-white">Channel Name</Label>
              <Input
                id="channelName"
                placeholder="e.g. general"
                {...form.register("channelName")}
                className="bg-transparent border-white/10 text-white"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isPublic" className="text-white">Public Channel</Label>
              <Switch
                id="isPublic"
                checked={form.watch("isPublic")}
                onCheckedChange={(checked) => form.setValue("isPublic", checked)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}