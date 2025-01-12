import { useRoute } from "wouter";
import { Card } from "@/components/ui/card";
import { MessageInput } from "@/components/MessageInput";
import { mockChannelMessages, mockChannels } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/UserAvatar";
import { useUser } from "@/hooks/use-user";

export default function ChannelPage() {
  const [, params] = useRoute('/channel/:id');
  const channelId = params?.id;
  const { user: currentUser } = useUser();

  const channel = mockChannels.find(c => c.id === channelId);
  const messages = mockChannelMessages.filter(m => m.channelId === channelId).map(msg => ({
    ...msg,
    sender: msg.sender.id === currentUser?.id ? currentUser : msg.sender
  }));

  const handleSendMessage = async (content: string) => {
    console.log('Sending message:', content);
    // In a real app, this would send via WebSocket
    return Promise.resolve();
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">#{channel?.name || 'unknown'}</h2>
        <p className="text-sm text-muted-foreground">{channel?.description}</p>
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
                  <span className="font-medium">{message.sender.username}</span>
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