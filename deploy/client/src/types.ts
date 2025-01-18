export interface Message {
  id: number;
  content?: string;
  channelId?: number;
  recipientId?: number;
  parentId?: number;
  timestamp: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  sender: {
    id: number;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
} 