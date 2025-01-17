import { useState } from 'react';
import { cn, getFullUrl } from "../lib/utils";
import { File as FileIcon, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { UserAvatar } from "./UserAvatar";
import { MessageReactions } from "./MessageReactions";
import { formatTimestamp } from "../lib/formatters";
import type { Message as MessageType } from "../types";

interface MessageProps {
  message: MessageType;
  isLastInGroup?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function Message({ message, isLastInGroup }: MessageProps) {
  const [showFullImage, setShowFullImage] = useState(false);
  const fileUrl = getFullUrl(message.fileUrl);

  const handleImageDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFileContent = () => {
    if (!fileUrl) return null;

    if (message.fileType?.startsWith('image/')) {
      return (
        <div className="mt-2">
          <img
            src={fileUrl}
            alt={message.fileName || 'Image'}
            className="max-w-[400px] max-h-[400px] rounded-lg cursor-pointer object-contain hover:opacity-90"
            onClick={() => setShowFullImage(true)}
          />
          
          <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
            <DialogContent className="sm:max-w-[90vw] md:max-w-[75vw] lg:max-w-[60vw] h-[80vh] p-0 bg-black/90 border-none overflow-hidden">
              <DialogHeader className="absolute top-0 right-0 p-2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => handleImageDownload(fileUrl, message.fileName!)}
                >
                  <Download className="h-5 w-5" />
                </Button>
              </DialogHeader>
              <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                <img
                  src={fileUrl}
                  alt={message.fileName || 'Image'}
                  className="w-auto h-auto max-w-[95%] max-h-[95%] object-contain"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }
    
    return (
      <a
        href={fileUrl}
        download={message.fileName}
        className="inline-flex items-center gap-2 p-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors mt-2"
      >
        <FileIcon className="h-4 w-4" />
        <span className="text-sm">{message.fileName}</span>
        <span className="text-xs text-white/50">
          ({formatFileSize(message.fileSize!)})
        </span>
      </a>
    );
  };

  return (
    <div className={cn(
      "flex items-start gap-3 px-4 py-2 hover:bg-white/5",
      !isLastInGroup && "pb-0"
    )}>
      <UserAvatar
        user={message.sender}
        className="h-8 w-8 mt-1"
      />
      <div className="flex-1 overflow-hidden">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white">
            {message.sender.displayName || message.sender.username}
          </span>
          <span className="text-xs text-white/50">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        
        <div>
          {message.content && (
            <p className="text-white/90">
              {message.content.split(/(@[\w\s-]+)/).map((part, i) => {
                if (part.startsWith('@')) {
                  return <span key={i} className="text-indigo-400 bg-indigo-400/10 hover:bg-indigo-400/20 px-2 py-0.5 rounded-md cursor-pointer transition-colors">{part}</span>;
                }
                return part;
              })}
            </p>
          )}
          {message.fileUrl && renderFileContent()}
        </div>
        
        <MessageReactions messageId={message.id.toString()} />
      </div>
    </div>
  );
} 