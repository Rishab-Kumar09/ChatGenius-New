import { Button } from "./ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Smile } from "lucide-react";
import { cn } from "../lib/utils";
import { memo, useCallback, useState, useRef, useEffect } from "react";
import { useUser } from "@/hooks/use-user";
import { useEventSource } from "@/hooks/use-event-source";
import { useToast } from "@/hooks/use-toast";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "🎉", "🙏", "👀", "🔥", "💯"];

interface MessageReactionsProps {
  messageId: string;
}

interface ReactionState {
  emoji: string;
  users: Array<{
    id: number;
    username: string;
    displayName?: string;
  }>;
}

const ReactionButton = memo(({ 
  emoji, 
  count, 
  isActive, 
  onClick,
  usernames 
}: { 
  emoji: string; 
  count: number; 
  isActive: boolean; 
  onClick: () => void;
  usernames: string[];
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isPressed, setIsPressed] = useState(false);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const handleMouseUp = () => setIsPressed(false);
    const handleMouseLeave = () => setIsPressed(false);

    button.addEventListener('mouseup', handleMouseUp);
    button.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      button.removeEventListener('mouseup', handleMouseUp);
      button.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={buttonRef}
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-xs gap-1 flex items-center justify-center select-none",
              "transition-all duration-200 ease-in-out transform hover:-translate-y-0.5",
              isActive && "bg-primary/10 hover:bg-primary/20",
              isPressed && "scale-95"
            )}
            onMouseDown={() => {
              setIsPressed(true);
              onClick();
            }}
          >
            <div className="flex items-center gap-1 pointer-events-none">
              <span className="transform transition-transform duration-200 hover:scale-110">{emoji}</span>
              <span>{count}</span>
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs p-2">
          {usernames.length > 0 ? (
            <>
              {usernames.slice(0, 3).join(", ")}
              {usernames.length > 3 && ` and ${usernames.length - 3} others`}
            </>
          ) : (
            "Be the first to react!"
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ReactionButton.displayName = "ReactionButton";

export function MessageReactions({ messageId }: MessageReactionsProps) {
  const { user } = useUser();
  const { lastEvent } = useEventSource();
  const { toast } = useToast();
  const [reactions, setReactions] = useState<Map<string, ReactionState>>(new Map());

  // Listen for reaction updates from SSE
  useEffect(() => {
    if (lastEvent?.type === 'reaction_update' && lastEvent.data.messageId.toString() === messageId) {
      const newReactions = new Map<string, ReactionState>();
      
      // Group reactions by emoji
      lastEvent.data.reactions.forEach((reaction: {
        userId: number;
        username: string;
        displayName?: string;
        emoji: string;
      }) => {
        const existing = newReactions.get(reaction.emoji) || { 
          emoji: reaction.emoji, 
          users: [] 
        };
        existing.users.push({
          id: reaction.userId,
          username: reaction.username,
          displayName: reaction.displayName
        });
        newReactions.set(reaction.emoji, existing);
      });
      
      setReactions(newReactions);
    }
  }, [lastEvent, messageId]);

  const handleReaction = useCallback(async (emoji: string) => {
    if (!user) {
      toast({
        title: "Cannot Add Reaction",
        description: "Please make sure you're logged in.",
        variant: "destructive"
      });
      return;
    }
    
    try {
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
    } catch (error) {
      console.error('Error updating reaction:', error);
      toast({
        title: "Error",
        description: "Failed to update reaction. Please try again.",
        variant: "destructive"
      });
    }
  }, [user, messageId, toast]);

  const hasUserReacted = useCallback((emoji: string) => {
    if (!user) return false;
    return reactions.get(emoji)?.users.some(u => u.id === user.id) || false;
  }, [reactions, user]);

  const getUsernames = useCallback((emoji: string) => {
    const reaction = reactions.get(emoji);
    if (!reaction) return [];
    return reaction.users.map(u => {
      if (user && u.id === user.id) return "You";
      return u.displayName || u.username;
    });
  }, [reactions, user]);

  return (
    <div className="flex items-center gap-1 mt-1 group">
      {Array.from(reactions.entries()).map(([emoji, reaction]) => (
        <ReactionButton
          key={emoji}
          emoji={emoji}
          count={reaction.users.length}
          isActive={hasUserReacted(emoji)}
          onClick={() => handleReaction(emoji)}
          usernames={getUsernames(emoji)}
        />
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0",
              "text-muted-foreground hover:text-foreground",
              "transition-all duration-200 hover:bg-primary/5",
              "opacity-0 group-hover:opacity-100"
            )}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" sideOffset={5}>
          <div className="flex gap-1 flex-wrap max-w-[200px]">
            {COMMON_EMOJIS.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  "transition-all duration-200",
                  "hover:scale-110 hover:bg-primary/10",
                  hasUserReacted(emoji) && "bg-primary/10"
                )}
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}