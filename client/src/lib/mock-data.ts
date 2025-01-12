import type { Channel, DirectMessage, Message, User } from "./types";

export const mockUsers: User[] = [
  { 
    id: 1,
    name: "You",
    displayName: "Rishab Kumar",
    email: "you@example.com",
    isOnline: true,
    status: 'online',
    username: "you",
    avatarUrl: "https://ui-avatars.com/api/?name=You&background=0D8ABC&color=fff",
    aboutMe: "Current user's profile",
    note: "My personal notes",
    createdAt: "2024-01-01T00:00:00Z"
  },
  { 
    id: 2,
    name: "Jane Smith",
    displayName: "Jane S.", // Added displayName
    email: "jane@example.com",
    isOnline: false,
    status: 'offline',
    username: "jane",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120",
    aboutMe: "Product Designer | Coffee Enthusiast | Adventure Seeker",
    note: "Working on the new design system",
    createdAt: "2023-12-15T00:00:00Z"
  },
  { 
    id: 3,
    name: "Bob Wilson",
    displayName: "Bob W.", // Added displayName
    email: "bob@example.com",
    isOnline: true,
    status: 'busy',
    username: "bob",
    avatarUrl: "https://ui-avatars.com/api/?name=Bob+Wilson&background=6366F1&color=fff",
    aboutMe: "Senior Developer | Tech Lead | Open Source Contributor",
    note: "Currently leading the backend team",
    createdAt: "2023-11-20T00:00:00Z"
  },
  {
    id: 4,
    name: "Sarah Parker",
    displayName: "Sarah P.", // Added displayName
    email: "sarah@example.com",
    isOnline: true,
    status: 'online',
    username: "sarah",
    avatarUrl: "https://ui-avatars.com/api/?name=Sarah+Parker&background=10B981&color=fff",
    aboutMe: "Marketing Manager | Social Media Expert | Content Creator",
    note: "Planning Q1 marketing strategy",
    createdAt: "2024-01-05T00:00:00Z"
  },
  {
    id: 5,
    name: "Mike Johnson",
    displayName: "Mike J.", // Added displayName
    email: "mike@example.com",
    isOnline: false,
    status: 'offline',
    username: "mike",
    avatarUrl: "https://ui-avatars.com/api/?name=Mike+Johnson&background=F43F5E&color=fff",
    aboutMe: "Project Manager | Agile Coach | Team Builder",
    note: "Organizing team building activities",
    createdAt: "2023-10-01T00:00:00Z"
  }
];

export const mockChannels: Channel[] = [
  { id: "1", name: "general", description: "General discussion" },
  { id: "2", name: "random", description: "Random chat" },
  { id: "3", name: "help", description: "Get help" },
];

export const mockDirectMessages: DirectMessage[] = [
  { id: "2", user: mockUsers[1] }, 
  { id: "3", user: mockUsers[2] }, 
  { id: "4", user: mockUsers[3] }, 
  { id: "5", user: mockUsers[4] }, 
];

export const mockChannelMessages: Message[] = [
  {
    id: "1",
    content: "Hey everyone! How's it going?",
    sender: { ...mockUsers[0] }, 
    timestamp: "2024-03-20T10:00:00Z",
    channelId: "1",
    reactions: [
      { emoji: "👋", users: [mockUsers[1]] },
      { emoji: "👍", users: [mockUsers[1], mockUsers[2]] },
    ],
    isDemo: true
  },
  {
    id: "2",
    content: "Pretty good! Working on some new features.",
    sender: { ...mockUsers[1] }, 
    timestamp: "2024-03-20T10:05:00Z",
    channelId: "1",
    reactions: [
      { emoji: "🎉", users: [mockUsers[0]] },
    ],
    isDemo: true
  },
  {
    id: "3",
    content: "Looking forward to seeing them!",
    sender: { ...mockUsers[3] }, 
    timestamp: "2024-03-20T10:10:00Z",
    channelId: "1",
    reactions: [],
    isDemo: true
  },
];

// Conversations for each direct message thread
export const mockDirectMessageThreads: Record<string, Message[]> = {
  "2": [ 
    {
      id: "dm1",
      content: "Hi! Need help with the project?",
      sender: { ...mockUsers[1] }, 
      timestamp: "2024-03-20T09:00:00Z",
      dmId: "2",
      reactions: [],
      isDemo: true
    },
    {
      id: "dm2",
      content: "Yes, could you review my code?",
      sender: { ...mockUsers[0] }, 
      timestamp: "2024-03-20T09:02:00Z",
      dmId: "2",
      reactions: [],
      isDemo: true
    }
  ],
  "3": [ 
    {
      id: "dm3",
      content: "Hey! Are you joining the meeting?",
      sender: { ...mockUsers[2] }, 
      timestamp: "2024-03-20T11:00:00Z",
      dmId: "3",
      reactions: [],
      isDemo: true
    },
    {
      id: "dm4",
      content: "Yes, I'll be there in 5 minutes",
      sender: { ...mockUsers[0] }, 
      timestamp: "2024-03-20T11:05:00Z",
      dmId: "3",
      reactions: [],
      isDemo: true
    }
  ],
  "4": [ 
    {
      id: "dm5",
      content: "Great progress on the design!",
      sender: { ...mockUsers[3] }, 
      timestamp: "2024-03-20T14:00:00Z",
      dmId: "4",
      reactions: [],
      isDemo: true
    },
    {
      id: "dm6",
      content: "Thanks! The team helped a lot.",
      sender: { ...mockUsers[0] }, 
      timestamp: "2024-03-20T14:05:00Z",
      dmId: "4",
      reactions: [],
      isDemo: true
    }
  ],
  "5": [ 
    {
      id: "dm7",
      content: "Document is ready for review",
      sender: { ...mockUsers[4] }, 
      timestamp: "2024-03-20T15:00:00Z",
      dmId: "5",
      reactions: [],
      isDemo: true
    },
    {
      id: "dm8",
      content: "I'll take a look right away",
      sender: { ...mockUsers[0] }, 
      timestamp: "2024-03-20T15:02:00Z",
      dmId: "5",
      reactions: [],
      isDemo: true
    }
  ]
};