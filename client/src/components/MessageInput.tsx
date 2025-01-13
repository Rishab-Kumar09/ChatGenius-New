import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Paperclip, X, Reply, Smile, Image, File, Maximize2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Message } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

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
    "🌳", "🌴", "🌵", "���", "🌿", "☘️", "🍀", "🍁",
    "🍂", "🍃", "🌍", "🌎", "🌏", "🌞", "🌛", "⭐"
  ],
  food: [
    "🍔", "🍟", "🍕", "🌭", "🍿", "🧂", "🥨", "🥯",
    "🥖", "🫓", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆",
    "🥚", "🍳", "🥘", "🍲", "🥣", "🥗", "🍿", "🧈"
  ]
};

interface MessageInputProps {
  onSend: (content: string, file?: File) => Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export function MessageInput({ 
  onSend, 
  placeholder = "Type a message...", 
  className, 
  disabled,
  replyingTo,
  onCancelReply
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('common');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create preview URLs for files
  useEffect(() => {
    const files = [selectedFile, ...fileQueue].filter((f): f is File => f !== null);
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      // Cleanup URLs when component unmounts or files change
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [selectedFile, fileQueue]);

  const processFileQueue = async () => {
    if (isSending || fileQueue.length === 0) return;
    
    setIsSending(true);
    const nextFile = fileQueue[0];
    
    try {
      await onSend("", nextFile);
      setFileQueue(prev => {
        const remaining = prev.slice(1);
        if (remaining.length > 0) {
          processFileQueue();
        }
        return remaining;
      });
    } catch (error) {
      console.error('Failed to send file:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((content.trim() || selectedFile || fileQueue.length > 0) && !disabled) {
      try {
        // Send first file with content
        if (selectedFile) {
          await onSend(content, selectedFile);
        } else if (content.trim()) {
          await onSend(content);
        }

        // Send remaining files
        for (const file of fileQueue) {
          await onSend("", file);
        }

        // Clear all states
        setContent("");
        setSelectedFile(null);
        setFileQueue([]);
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Add all files to the queue
    if (!selectedFile) {
      setSelectedFile(files[0]);
      setFileQueue(files.slice(1));
    } else {
      setFileQueue(prev => [...prev, ...files]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    if (index === 0) {
      setSelectedFile(fileQueue[0] || null);
      setFileQueue(prev => prev.slice(1));
    } else {
      setFileQueue(prev => prev.filter((_, i) => i !== index - 1));
    }
  };

  const renderFilePreview = (file: File, url: string, index: number) => {
    const isImage = file.type.startsWith('image/');

    return (
      <div key={url} className="relative group">
        <div className="relative aspect-square w-20 rounded-md overflow-hidden border bg-muted/50">
          {isImage ? (
            <img
              src={url}
              alt={file.name}
              className="h-full w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setSelectedPreview(url)}
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center p-2 gap-1">
              <File className="h-8 w-8 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate max-w-full">
                {file.name}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-0.5 h-5 w-5 bg-background/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => removeFile(index)}
          >
            <X className="h-3 w-3" />
          </Button>
          {isImage && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute bottom-0.5 right-0.5 h-5 w-5 bg-background/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setSelectedPreview(url)}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={cn(
        "z-10 flex flex-col gap-2 p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75",
        className
      )}
    >
      {replyingTo && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
          <Reply className="h-4 w-4" />
          <span>Replying to {replyingTo.sender.username}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {(selectedFile || fileQueue.length > 0) && (
        <div className="bg-muted/50 p-2 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              <span>{previewUrls.length} {previewUrls.length === 1 ? 'file' : 'files'} selected</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setSelectedFile(null);
                setFileQueue([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[selectedFile, ...fileQueue].map((file, index) => 
              file && renderFilePreview(file, previewUrls[index], index)
            )}
          </div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] w-full resize-none bg-muted/50 focus-visible:bg-background"
          rows={1}
          disabled={disabled}
        />
        <div className="flex gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                className="text-muted-foreground hover:text-foreground"
              >
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[320px] p-0 shadow-lg rounded-lg overflow-hidden border bg-popover" 
              align="end" 
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
                        onClick={() => insertEmoji(emoji)}
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
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,application/pdf,.doc,.docx,.txt"
            className="hidden"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button 
            type="submit" 
            size="icon" 
            disabled={disabled || (!content.trim() && !selectedFile)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Dialog open={!!selectedPreview} onOpenChange={() => setSelectedPreview(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          {selectedPreview && (
            <img
              src={selectedPreview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </form>
  );
}