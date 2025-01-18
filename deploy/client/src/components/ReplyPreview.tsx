import { X } from "lucide-react";
import { Button } from "./ui/button";
import { UserAvatar } from "./UserAvatar";
import type { ThreadMessage } from "@/lib/types";

interface ReplyPreviewProps {
  message: ThreadMessage;
  onCancel: () => void;
}

export function ReplyPreview({ message, onCancel }: ReplyPreviewProps) {
  return (
    <div className="p-2 border-t bg-muted/30 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <UserAvatar user={message.sender} className="h-4 w-4" interactive={false} />
          <span className="text-sm font-medium">{message.sender.displayName || message.sender.username}</span>
        </div>
        <p className="text-sm text-muted-foreground truncate">{message.content}</p>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6" 
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
} 