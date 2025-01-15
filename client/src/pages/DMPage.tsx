import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { MessageInput } from "@/components/MessageInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/UserAvatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface Message {
  id: string;
  content: string;
  sender: {
    id: number;
    username: string;
    displayName: string | null;
  };
  recipientId: string;
  timestamp: string;
}

export default function DMPage() {
  const [, params] = useRoute('/dm/:id');
  const dmId = params?.id;
  const queryClient = useQueryClient();

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages', dmId],
    queryFn: async () => {
      const res = await fetch(`/api/messages?recipientId=${dmId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    refetchInterval: 3000 // Poll every 3 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          recipientId: dmId
        }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ queryKey: ['/api/messages', dmId] });
    },
  });

  const handleSendMessage = async (content: string) => {
    try {
      await sendMessageMutation.mutateAsync(content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b p-4 flex items-center gap-3">
        {dmId && (
          //This section needs to fetch the DM data corresponding to dmId.  Since the mock data is gone,  this section will likely need a corresponding API call and state management. For now, leaving as is.  This is a placeholder and may require further adjustment.
          <>
            {/* Placeholder until backend data fetching is implemented */}
            <div>
              <h2 className="text-lg font-semibold">@{dmId}</h2>
              <p className="text-sm text-muted-foreground">
                Loading...
              </p>
            </div>
          </>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <UserAvatar 
                user={message.sender} 
                className="h-8 w-8 flex-shrink-0" 
                interactive
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{message.sender.displayName || message.sender.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <MessageInput onSend={handleSendMessage} />
    </div>
  );
}