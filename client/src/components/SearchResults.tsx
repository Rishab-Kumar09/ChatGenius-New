import { Message, Channel, User } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface SearchResultsProps {
  query: string;
  messages?: Message[];
  channels?: Channel[];
  users?: User[];
  onSelect: (type: 'message' | 'channel' | 'dm', id: string | number) => void;
  onClose?: () => void;
}

export function SearchResults({
  query,
  messages = [],
  channels = [],
  users = [],
  onSelect,
  onClose
}: SearchResultsProps) {
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  if (!query) return null;

  const handleUserSelect = async (userId: string | number) => {
    try {
      // Navigate to DM route with the selected user ID
      setLocation(`/dm/${userId}`);
      onSelect('dm', userId);
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to open DM:', error);
      toast({
        title: "Error",
        description: "Failed to open direct message",
        variant: "destructive",
      });
    }
  };

  const highlightText = (text: string) => {
    if (!query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return <mark key={i} className="bg-yellow-200 dark:bg-yellow-900 dark:text-white px-1 rounded">{part}</mark>;
      }
      return part;
    });
  };

  if (users.length === 0 && channels.length === 0 && messages.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No results found for "{query}"
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      {users.length > 0 && (
        <div className="p-2">
          <h3 className="text-sm font-medium mb-2 px-2">People</h3>
          {users.map(user => (
            <Button
              key={user.id}
              variant="ghost"
              className="w-full justify-start mb-1 h-auto py-2"
              onClick={() => handleUserSelect(user.id)}
            >
              <UserAvatar 
                user={user} 
                className="h-6 w-6 mr-2 flex-shrink-0" 
                interactive={true}
              />
              <div className="flex flex-col items-start">
                <span>{highlightText(user.displayName || user.username)}</span>
                <span className="text-xs text-muted-foreground">
                  @{highlightText(user.username)}
                </span>
              </div>
            </Button>
          ))}
        </div>
      )}

      {channels.length > 0 && (
        <div className="p-2">
          <h3 className="text-sm font-medium mb-2 px-2">Channels</h3>
          {channels.map(channel => {
            const isMember = channel.members?.some(member => member.id === currentUser?.id);

            return (
              <Button
                key={channel.id}
                variant="ghost"
                className="w-full justify-between mb-1 h-auto py-2 group"
                onClick={() => onSelect('channel', channel.id)}
              >
                <div className="flex items-center">
                  <Hash className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <span>{highlightText(channel.name)}</span>
                </div>
                {!isMember && (
                  <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to join
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}

      {messages.length > 0 && (
        <div className="p-2">
          <h3 className="text-sm font-medium mb-2 px-2">Messages</h3>
          {messages.map(message => (
            <Button
              key={message.id}
              variant="ghost"
              className="w-full justify-start mb-1 h-auto py-2"
              onClick={() => {
                const chatId = message.channelId || message.dmId;
                if (chatId) {
                  onSelect(
                    message.channelId ? 'channel' : 'dm',
                    chatId
                  );
                }
              }}
            >
              <div className="flex items-start gap-2 w-full overflow-hidden">
                <UserAvatar 
                  user={message.sender} 
                  className="h-6 w-6 mt-1 flex-shrink-0"
                  interactive={true}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium whitespace-nowrap">
                      {message.sender.displayName || message.sender.username}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(message.timestamp), 'PP')}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground break-words">
                    {highlightText(message.content)}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}