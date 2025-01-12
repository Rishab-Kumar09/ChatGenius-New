import { ScrollArea } from "@/components/ui/scroll-area";
import { Message, ThreadMessage, Reaction as MessageReaction } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";
import { format, parseISO } from "date-fns";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, ChevronDown, ChevronRight, Smile, Paperclip } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "../components/ui/use-toast";

interface MessageThreadProps {
  messages: Message[];
  onReply?: (message: Message) => void;
  replyingTo?: Message | null;
  currentUserId: string;
  onReaction?: (messageId: string, emoji: string) => void;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

export function MessageThread({
  messages,
  onReply,
  replyingTo,
  currentUserId,
  onReaction,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('common');
  const [removingReactions, setRemovingReactions] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Toggle thread expansion
  const toggleThread = (messageId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  // Handle reaction click
  const handleReactionClick = (messageId: string, emoji: string) => {
    const reactionKey = `${messageId}-${emoji}`;
    const message = messageMap.get(messageId.toString());
    const reactions = message?.reactions || [];
    const isRemoving = reactions.some(r => r.users?.some(user => user.id.toString() === currentUserId));
    
    if (isRemoving && message) {
      // Optimistically update the UI by removing the reaction
      const updatedMessage: ThreadMessage = {
        ...message,
        replies: message.replies || [],
        reactions: reactions.map(r => ({
          ...r,
          users: (r.users || []).filter(user => user.id.toString() !== currentUserId)
        })).filter(r => r.users.length > 0)
      };
      messageMap.set(messageId.toString(), updatedMessage);
      
      // Trigger re-render
      setRemovingReactions(prev => new Set(prev).add(reactionKey));
      // Remove from removing state after animation
      setTimeout(() => {
        setRemovingReactions(prev => {
          const next = new Set(prev);
          next.delete(reactionKey);
          return next;
        });
      }, 200); // Match the CSS transition duration
    }

    onReaction?.(messageId, emoji);
    // Close emoji picker after selection
    const popover = document.querySelector('[data-state="open"]');
    if (popover) {
      (popover as HTMLElement).click();
    }
  };

  // Emoji sets for each category
  const emojisByCategory = {
    common: [
      "👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🙏",
      "✨", "🔥", "💯", "⭐", "💪", "👀", "🤔", "👏"
    ],
    smileys: [
      "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊",
      "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘",
      "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪",
      "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏"
    ],
    hearts: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "💖", "💗", "💓", "💞",
      "💕", "💝", "💘", "💟", "💌", "💋", "💄", "💎"
    ],
    hands: [
      "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️",
      "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆",
      "👇", "☝️", "👋", "🤚", "✋", "🖐️", "🖖", "👏",
      "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳"
    ],
    symbols: [
      "⭐", "✨", "💫", "🌟", "⚡", "🔥", "💥", "🎯",
      "💯", "❗", "❓", "💭", "💬", "👥", "🔍", "📍",
      "💡", "✅", "❌", "⭕", "❤️", "💤", "💈", "🎵"
    ],
    activities: [
      "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱",
      "🎮", "🎲", "🎭", "🎨", "🎬", "🎤", "🎧", "🎸",
      "🎹", "🎯", "🎳", "🎪", "🎠", "🎡", "🎢", "🎪"
    ],
    nature: [
      "🌺", "🌸", "🌼", "🌻", "🌹", "🌷", "🌱", "🌲",
      "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁",
      "🍂", "🍃", "🌍", "🌎", "🌏", "🌞", "🌛", "⭐"
    ],
    food: [
      "🍔", "🍟", "🍕", "🌭", "🍿", "🧂", "🥨", "🥯",
      "🥖", "🫓", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆",
      "🥚", "🍳", "🥘", "🍲", "🥣", "🥗", "🍿", "🧈"
    ]
  };

  // Organize messages into a nested structure
  const messageMap = new Map<string, ThreadMessage>();
  const topLevelMessages: ThreadMessage[] = [];

  // First pass: Create message objects with replies array
  messages.forEach(message => {
    if (!messageMap.has(message.id.toString())) {
      messageMap.set(message.id.toString(), { 
        ...message, 
        replies: [], 
        depth: 0 
      });
    }
  });

  // Second pass: Build the reply hierarchy and set depths
  messages.forEach(message => {
    const messageWithReplies = messageMap.get(message.id.toString())!;
    
    if (message.parentId) {
      const parent = messageMap.get(message.parentId.toString());
      if (parent) {
        // Only add to parent's replies if not already there
        const existingReplyIndex = parent.replies.findIndex(reply => reply.id === message.id);
        if (existingReplyIndex === -1) {
          messageWithReplies.depth = parent.depth + 1;
          messageWithReplies.parentMessage = parent;
          parent.replies.push(messageWithReplies);
        } else {
          // Update existing reply with latest data
          parent.replies[existingReplyIndex] = {
            ...messageWithReplies,
            depth: parent.depth + 1,
            parentMessage: parent,
            replies: parent.replies[existingReplyIndex].replies
          };
        }
      } else {
        // If parent not found, add to top level if not already there
        const existingMessageIndex = topLevelMessages.findIndex(msg => msg.id === message.id);
        if (existingMessageIndex === -1) {
          messageWithReplies.depth = 0;
          topLevelMessages.push(messageWithReplies);
        }
      }
    } else {
      // Add to top level if not already there
      const existingMessageIndex = topLevelMessages.findIndex(msg => msg.id === message.id);
      if (existingMessageIndex === -1) {
        messageWithReplies.depth = 0;
        topLevelMessages.push(messageWithReplies);
      }
    }
  });

  // Third pass: Ensure correct depths for nested replies
  const updateDepths = (message: ThreadMessage, depth: number) => {
    message.depth = depth;
    message.replies.forEach(reply => {
      updateDepths(reply, depth + 1);
    });
  };

  topLevelMessages.forEach(message => updateDepths(message, 0));

  // Sort messages by timestamp
  const sortByTimestamp = (a: ThreadMessage, b: ThreadMessage) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  };

  // Sort top-level messages and their replies recursively
  const sortRepliesRecursively = (message: ThreadMessage) => {
    message.replies.sort(sortByTimestamp);
    message.replies.forEach(reply => sortRepliesRecursively(reply));
  };

  topLevelMessages.sort(sortByTimestamp);
  topLevelMessages.forEach(message => sortRepliesRecursively(message));

  // Format timestamp with fallback
  const formatMessageTime = (timestamp: string | undefined) => {
    if (!timestamp) return 'Just now';
    try {
      return format(parseISO(timestamp), 'MMM d, h:mm a');
    } catch (e) {
      return 'Just now';
    }
  };

  // Get reply chain text
  const getReplyChainText = (message: ThreadMessage) => {
    if (!message.parentMessage) return null;
    return `Replying to ${message.parentMessage.sender.id.toString() === currentUserId ? 
      "yourself" : 
      message.parentMessage.sender.displayName || message.parentMessage.sender.username}`;
  };

  // Render a single message with its replies
  const renderMessage = (message: ThreadMessage) => {
    const isBeingRepliedTo = replyingTo?.id === message.id;
    const isExpanded = expandedThreads.has(message.id.toString());
    const hasReplies = message.replies.length > 0;
    const indentLevel = message.depth || 0;
    const marginLeft = indentLevel * 24;

    const reactions = message.reactions || [];
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = { emoji: reaction.emoji, count: 0, users: [] };
      }
      acc[reaction.emoji].count++;
      acc[reaction.emoji].users = reaction.users?.map(user => user.id.toString()) || [];
      return acc;
    }, {} as Record<string, GroupedReaction>);

    return (
      <div key={message.id} className="group">
        <div 
          className={cn(
            "flex gap-3 hover:bg-muted/30 py-2 rounded transition-colors relative",
            indentLevel > 0 && "pl-6" // Add left padding for indented messages
          )}
          style={{ 
            marginLeft: `${marginLeft}px`,
            borderLeft: indentLevel > 0 ? '2px solid hsl(var(--muted))' : 'none' // Add thread line
          }}
        >
          <UserAvatar 
            user={message.sender} 
            className="h-8 w-8 flex-shrink-0"
            interactive
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium text-base">
                {message.sender.id.toString() === currentUserId ? 
                  "You" : 
                  message.sender.displayName || message.sender.username}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatMessageTime(message.timestamp)}
              </span>
              {message.parentMessage && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  Replying to {message.parentMessage.sender.id.toString() === currentUserId ? 
                    "yourself" : 
                    message.parentMessage.sender.displayName || message.parentMessage.sender.username}
                </span>
              )}
            </div>
            <p className="text-base mt-1 mb-2">{message.content}</p>
            {message.fileUrl && (
              <div className="mt-2 mb-3">
                {message.fileType?.startsWith('image/') ? (
                  <img 
                    src={message.fileUrl} 
                    alt={message.fileName || 'Attached image'} 
                    className="max-w-[300px] rounded-lg border"
                  />
                ) : (
                  <a 
                    href={message.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{message.fileName}</span>
                    {message.fileSize && (
                      <span className="text-muted-foreground">
                        ({Math.round(message.fileSize / 1024)}KB)
                      </span>
                    )}
                  </a>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {/* Reactions display */}
              {Object.values(groupedReactions).map(reaction => (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReactionClick(message.id.toString(), reaction.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-200",
                    removingReactions.has(`${message.id}-${reaction.emoji}`) && "opacity-0 scale-95",
                    reaction.users.includes(currentUserId) 
                      ? "bg-primary/15 text-primary ring-1 ring-primary/20" 
                      : "bg-muted/50 hover:bg-muted/80"
                  )}
                >
                  <span role="img" aria-label="emoji" className="text-base leading-none">
                    {reaction.emoji}
                  </span>
                  <span className="text-xs font-medium leading-none">{reaction.count}</span>
                </button>
              ))}

              {/* Message actions */}
              <div className="flex items-center gap-3 text-sm">
                {/* Quick reactions */}
                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-[320px] p-0 shadow-lg rounded-lg overflow-hidden border bg-popover" 
                      align="start" 
                      sideOffset={5}
                    >
                      {/* Category tabs */}
                      <div className="border-b flex items-center p-2 gap-1.5 bg-muted/50">
                        {[
                          { id: 'common', icon: '⭐', label: 'Common' },
                          { id: 'smileys', icon: '😀', label: 'Smileys' },
                          { id: 'hearts', icon: '❤️', label: 'Hearts' },
                          { id: 'hands', icon: '👋', label: 'Hands' },
                          { id: 'symbols', icon: '✨', label: 'Symbols' },
                          { id: 'activities', icon: '⚽', label: 'Activities' },
                          { id: 'nature', icon: '🌺', label: 'Nature' },
                          { id: 'food', icon: '🍔', label: 'Food' }
                        ].map(category => (
                          <Button 
                            key={category.id}
                            variant={activeEmojiCategory === category.id ? "secondary" : "ghost"}
                            size="sm" 
                            onClick={() => setActiveEmojiCategory(category.id)}
                            className={cn(
                              "h-8 w-8 p-0 flex items-center justify-center relative group",
                              activeEmojiCategory === category.id && "bg-background shadow-sm"
                            )}
                          >
                            <span className="text-lg">{category.icon}</span>
                            <span className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 
                              text-xs bg-popover px-2 py-1 rounded-md border shadow-sm
                              opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              {category.label}
                            </span>
                          </Button>
                        ))}
                      </div>

                      <ScrollArea className="h-[300px]">
                        <div className="p-2">
                          <div className="grid grid-cols-8 gap-1">
                            {emojisByCategory[activeEmojiCategory as keyof typeof emojisByCategory].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleReactionClick(message.id.toString(), emoji)}
                                className="hover:bg-accent p-1.5 rounded-md text-xl"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </ScrollArea>
                      <div className="p-2 border-t text-center">
                        <span className="text-xs text-muted-foreground">
                          Emoji Picker by Rishab Kumar ©️ 2025
                        </span>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <button
                  className="text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => onReply?.(message)}
                >
                  Reply
                </button>
                {hasReplies && (
                  <button
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleThread(message.id.toString())}
                  >
                    {isExpanded ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                    <span>{message.replies.length} {message.replies.length === 1 ? 'reply' : 'replies'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        {hasReplies && isExpanded && (
          <div className="space-y-1">
            {message.replies.map(reply => renderMessage(reply))}
          </div>
        )}
      </div>
    );
  };

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-2">
        {topLevelMessages.map(message => renderMessage(message))}
      </div>
    </ScrollArea>
  );
}