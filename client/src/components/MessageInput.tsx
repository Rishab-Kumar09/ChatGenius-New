import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizontal, Paperclip, X, Reply, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { Message } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🙏",
  "✨", "🔥", "💯", "⭐", "💪", "👀", "🤔", "👏"
];

interface MessageInputProps {
  onSend: (content: string, file?: File) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((content.trim() || selectedFile) && !disabled) {
      onSend(content, selectedFile || undefined);
      setContent("");
      setSelectedFile(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-2 p-4", className)}>
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
      {selectedFile && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
          <Paperclip className="h-4 w-4" />
          <span>{selectedFile.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={() => setSelectedFile(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[44px] w-full resize-none"
          rows={1}
          disabled={disabled}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled}
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" sideOffset={5}>
            <div className="flex gap-1 flex-wrap max-w-[200px]">
              {COMMON_EMOJIS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:scale-110 hover:bg-primary/10"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button type="submit" size="icon" disabled={disabled || (!content.trim() && !selectedFile)}>
          <SendHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}