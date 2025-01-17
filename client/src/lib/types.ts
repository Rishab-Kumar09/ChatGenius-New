import type { SelectUser } from "@db/schema";

export interface User {
  id: number;
  username: string;
  email?: string | null;
  displayName?: string | null;
  isOnline?: boolean;
  status?: 'online' | 'busy' | 'offline';
  presence?: { status: 'online' | 'busy' | 'offline' };
  isTyping?: boolean;
  avatarUrl?: string | null;
  aboutMe?: string | null;
  note?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Channel {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  isPrivate: boolean;
  role?: 'owner' | 'member' | null;
  isMember?: boolean;
  isPendingInvitation?: boolean;
  memberCount: number;
}

export interface DirectMessage {
  id: string;
  user: User;
}

export interface Message {
  id: string;
  content: string;
  sender: User;
  timestamp: string;
  channelId?: string;
  dmId?: string;
  recipientId?: string | number;
  readBy?: string[]; 
  parentId?: string; 
  replyCount?: number;
  thread?: Message[];
  reactions?: Reaction[];
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
}

export interface Reaction {
  emoji: string;
  users: User[];
  count?: number;
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'busy' | 'offline';
  lastSeen?: string;
}

export interface TypingIndicator {
  userId: string;
  channelId?: string;
  dmId?: string;
  isTyping: boolean;
}

export interface ChannelInvite {
  id: string;
  channelId: string;
  userId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface SearchResults {
  messages: Message[];
  channels: Channel[];
  users: User[];
}

export interface ThreadMessage extends Message {
  replies: ThreadMessage[];
  depth: number;
  parentMessage?: ThreadMessage;
}