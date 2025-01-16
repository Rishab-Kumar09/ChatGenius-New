import { ScrollArea } from "@/components/ui/scroll-area";
import { Message, ThreadMessage, Reaction as MessageReaction } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, ChevronDown, ChevronRight, Smile, Paperclip, Maximize2, X, Trash2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MessageThreadProps {
  messages: Message[];
  onReply?: (message: Message) => void;
  replyingTo?: Message | null;
  currentUserId: string;
  onReaction?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => Promise<void>;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
}

interface GroupedMessage extends ThreadMessage {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}

export function MessageThread({
  messages,
  onReply,
  replyingTo,
  currentUserId,
  onReaction,
  onDelete,
}: MessageThreadProps) {
  if (!messages || messages.length === 0) {
    return <div className="flex-1 p-4 text-center text-muted-foreground">No messages yet</div>;
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('common');
  const [removingReactions, setRemovingReactions] = useState<Set<string>>(new Set());
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

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

  // Group messages by sender and timestamp proximity
  const groupMessages = (messages: ThreadMessage[]): GroupedMessage[] => {
    return messages.map((message, index, array) => {
      const prevMessage = array[index - 1];
      const nextMessage = array[index + 1];
      
      const isFirstInGroup = !prevMessage || 
        prevMessage.sender.id.toString() !== message.sender.id.toString() ||
        message.parentId || // Break group if message is a reply
        (prevMessage.parentId !== message.parentId) || // Break group if parent message changes
        (message.timestamp && prevMessage.timestamp && 
         differenceInMinutes(parseISO(message.timestamp), parseISO(prevMessage.timestamp)) > 5);
      
      const isLastInGroup = !nextMessage || 
        nextMessage.sender.id.toString() !== message.sender.id.toString() ||
        nextMessage.parentId || // Break group if next message is a reply
        (nextMessage.parentId !== message.parentId) || // Break group if parent message changes
        (message.timestamp && nextMessage.timestamp && 
         differenceInMinutes(parseISO(nextMessage.timestamp), parseISO(message.timestamp)) > 5);

      return {
        ...message,
        isFirstInGroup: Boolean(isFirstInGroup),
        isLastInGroup: Boolean(isLastInGroup),
      } as GroupedMessage;
    });
  };

  // Format timestamp with fallback
  const formatMessageTime = (timestamp: string | undefined) => {
    if (!timestamp) return 'Just now';
    try {
      return format(parseISO(timestamp), 'MMM d, h:mm a');
    } catch (e) {
      return 'Just now';
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !onDelete) return;

    try {
      await onDelete(messageToDelete);
      toast({
        title: "Message deleted",
        description: "Your message has been deleted successfully."
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive"
      });
    } finally {
      setMessageToDelete(null);
    }
  };

  // Render a single message with its replies
  const renderMessage = (message: GroupedMessage) => {
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
            "flex gap-3 hover:bg-muted/30 rounded transition-colors relative",
            indentLevel > 0 && "pl-6", // Add left padding for indented messages
            message.isFirstInGroup ? "pt-2" : "pt-0.5",
            message.isLastInGroup ? "pb-2" : "pb-0.5"
          )}
          style={{ 
            marginLeft: `${marginLeft}px`,
            borderLeft: indentLevel > 0 ? '2px solid hsl(var(--muted))' : 'none' // Add thread line
          }}
        >
          {message.isFirstInGroup ? (
            <UserAvatar 
              user={message.sender} 
              className="h-8 w-8 flex-shrink-0"
              interactive
            />
          ) : (
            <div className="w-8 flex-shrink-0" /> // Placeholder for avatar spacing
          )}
          <div className="flex-1 min-w-0">
            {message.isFirstInGroup && (
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
            )}
            <p className={cn(
              "text-base",
              message.isFirstInGroup ? "mt-1" : "mt-0",
              message.isLastInGroup ? "mb-2" : "mb-0.5"
            )}>{message.content}</p>
            {message.fileUrl && (
              <div className={cn(
                message.isLastInGroup ? "mb-3" : "mb-1",
                "mt-2"
              )}>
                {message.fileType?.startsWith('image/') ? (
                  <div className="relative group/image inline-block">
                    <img 
                      src={message.fileUrl} 
                      alt={message.fileName || 'Attached image'} 
                      className="max-h-[200px] w-auto rounded-lg border cursor-pointer hover:brightness-90 transition-all"
                      onClick={() => setExpandedImage(message.fileUrl || null)}
                    />
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-background/50 backdrop-blur-sm opacity-0 group-hover/image:opacity-100 transition-opacity"
                        onClick={() => setExpandedImage(message.fileUrl || null)}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      {message.sender.id.toString() === currentUserId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-background/50 backdrop-blur-sm opacity-0 group-hover/image:opacity-100 transition-opacity hover:text-destructive"
                          onClick={() => setMessageToDelete(message.id.toString())}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
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
                    {message.sender.id.toString() === currentUserId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:text-destructive"
                        onClick={() => setMessageToDelete(message.id.toString())}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            {message.isLastInGroup && (
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

                  {message.sender.id.toString() === currentUserId && (
                    <button
                      className="text-muted-foreground hover:text-destructive hover:underline"
                      onClick={() => setMessageToDelete(message.id.toString())}
                    >
                      Delete
                    </button>
                  )}

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
            )}
          </div>
        </div>
        {hasReplies && isExpanded && (
          <div className="space-y-1">
            {groupMessages(message.replies).map(reply => renderMessage(reply))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full">
      <div className="space-y-2 p-4">
        {groupMessages(topLevelMessages).map(message => renderMessage(message))}
      </div>

      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          {expandedImage && (
            <div className="relative w-full h-full">
              <img
                src={expandedImage}
                alt="Full size"
                className="w-full h-full object-contain"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 bg-background/50 backdrop-blur-sm"
                onClick={() => setExpandedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!messageToDelete} onOpenChange={() => setMessageToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}