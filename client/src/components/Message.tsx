import { useState } from 'react';
import { useUser } from '../hooks/use-user';
import { cn } from "../lib/utils";
import { File as FileIcon, Download, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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
  const { user } = useUser();
  const [showFullImage, setShowFullImage] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const queryClient = useQueryClient();

  const editMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string, content: string }) => {
      const response = await axios.patch(`/api/messages/${id}`, { content });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setIsEditing(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await axios.delete(`/api/messages/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    }
  });

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content);
  };

  const handleSaveEdit = async () => {
    if (editedContent.trim() !== message.content) {
      await editMutation.mutateAsync({
        id: message.id.toString(),
        content: editedContent.trim()
      });
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this message?')) {
      await deleteMutation.mutateAsync(message.id.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedContent(message.content);
    }
  };

  const handleImageDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFileContent = () => {
    if (message.fileType?.startsWith('image/')) {
      return (
        <div className="mt-2">
          <img
            src={message.fileUrl}
            alt={message.fileName || 'Image'}
            className="max-w-[300px] max-h-[300px] rounded-lg cursor-pointer object-contain hover:opacity-90"
            onClick={() => setShowFullImage(true)}
          />

          <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
            <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-none">
              <DialogHeader className="absolute top-0 right-0 p-2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => handleImageDownload(message.fileUrl!, message.fileName!)}
                >
                  <Download className="h-5 w-5" />
                </Button>
              </DialogHeader>
              <div className="w-full h-full flex items-center justify-center p-4">
                <img
                  src={message.fileUrl}
                  alt={message.fileName || 'Image'}
                  className="max-w-full max-h-[85vh] object-contain"
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    return (
      <a
        href={message.fileUrl}
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
        <div className="flex items-baseline gap-2 group">
          <span className="text-sm font-medium text-white">
            {message.sender.displayName || message.sender.username}
          </span>
          <span className="text-xs text-white/50">
            {formatTimestamp(message.timestamp)}
            {message.isEdited && " (edited)"}
          </span>
          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100/10 focus:ring-0">
                    <MoreVertical className="h-4 w-4 text-gray-200" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[140px]">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </div>

        <div>
          {message.content && isEditing ? (
            <div className="flex gap-2 items-center">
              <Input
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setIsEditing(false);
                setEditedContent(message.content);
              }}>Cancel</Button>
            </div>
          ) : (
            <p className="text-white/90">{message.content}</p>
          )}
          {message.fileUrl && renderFileContent()}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <MessageReactions messageId={message.id.toString()} />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleEdit}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}