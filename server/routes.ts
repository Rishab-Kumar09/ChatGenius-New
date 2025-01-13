import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { messages, users, channels, channelMembers, channelInvitations, reactions } from "../db/schema";
import { eq, desc, sql, and, isNull, or, ne, isNotNull, inArray } from "drizzle-orm";
import express from 'express';
import { setupAuth } from "./auth";
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import type { SelectChannel } from "@db/schema";

// Interface for SSE clients
interface SSEClient {
  id: string;
  res: Response;
}

// SSE event types
type SSEEventType = 
  | 'message'
  | 'presence'
  | 'channel'
  | 'error'
  | 'typing'
  | 'connected'
  | 'conversation_update';

interface SSEEvent {
  type: SSEEventType;
  data: any;
}

// Keep track of connected SSE clients
const clients = new Set<SSEClient>();

// Auth middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

export function registerRoutes(app: Express): Server {
  // Set up authentication routes and middleware
  setupAuth(app);

  const httpServer = createServer(app);

  // Set up WebSocket server attached to the HTTP server
  const wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: false
  });

  // Handle WebSocket upgrade
  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);

      // Let Vite handle its own WebSocket connections
      if (url.pathname.startsWith('/@vite/client') || url.pathname.startsWith('/vite-hmr')) {
        console.log('Vite HMR WebSocket request, ignoring');
        socket.destroy();
        return;
      }

      // Only handle WebSocket connections to /ws path
      if (!url.pathname.startsWith('/ws')) {
        console.log('Invalid WebSocket path:', url.pathname);
        socket.destroy();
        return;
      }

      // Handle our application's WebSocket connections
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('Application WebSocket connection established on', url.pathname);
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      socket.destroy();
    }
  });

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to WebSocket');

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });

    ws.on('message', async (data: string) => {
      try {
        const event = JSON.parse(data);
        console.log('Received WebSocket event:', event);

        switch (event.type) {
          case 'new_message':
            // ... existing message handling ...
            break;

          case 'presence_update':
            // ... existing presence handling ...
            break;

          case 'reaction_update':
            const { messageId, emoji, userId } = event;

            try {
              await db.transaction(async (tx) => {
                // Efficient single query to check and handle reaction
                const result = await tx
                  .select({
                    id: reactions.id,
                    exists: sql`1`
                  })
                  .from(reactions)
                  .where(
                    and(
                      eq(reactions.messageId, parseInt(messageId)),
                      eq(reactions.userId, parseInt(userId)),
                      eq(reactions.emoji, emoji)
                    )
                  )
                  .limit(1);

                // Single operation - either delete or insert
                if (result.length > 0) {
                  await tx
                    .delete(reactions)
                    .where(eq(reactions.id, result[0].id));
                } else {
                  await tx
                    .insert(reactions)
                    .values({
                      messageId: parseInt(messageId),
                      userId: parseInt(userId),
                      emoji
                    });
                }

                // Efficient single query to get updated reactions
                const updatedReactions = await tx
                  .select({
                    id: reactions.id,
                    messageId: reactions.messageId,
                    userId: reactions.userId,
                    emoji: reactions.emoji,
                    username: users.username,
                    displayName: users.displayName
                  })
                  .from(reactions)
                  .leftJoin(users, eq(reactions.userId, users.id))
                  .where(eq(reactions.messageId, parseInt(messageId)));

                // Immediate broadcast to all clients
                const reactionUpdate = {
                  type: 'reaction_update',
                  data: {
                    messageId: parseInt(messageId),
                    reactions: updatedReactions.map(reaction => ({
                      id: reaction.id,
                      messageId: reaction.messageId,
                      userId: reaction.userId,
                      emoji: reaction.emoji,
                      user: {
                        id: reaction.userId,
                        username: reaction.username,
                        displayName: reaction.displayName
                      }
                    }))
                  }
                };

                wss.clients.forEach(client => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(reactionUpdate));
                  }
                });
              });
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Failed to update reaction' }
              }));
            }
            break;

          default:
            console.warn('Unknown event type:', event.type);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
  });

  // SSE endpoint for real-time updates
  app.get("/api/events", requireAuth, (req: Request, res: Response) => {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no'
    };

    res.writeHead(200, headers);

    // Helper function to send events to this client
    const sendEvent = (event: SSEEvent) => {
      const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
      res.write(eventString);
    };

    // Send initial connection event
    sendEvent({ type: 'connected', data: { userId: req.user?.id } });

    // Add client to connected clients
    const client: SSEClient = { id: req.user!.id.toString(), res };
    clients.add(client);

    // Handle client disconnect
    req.on('close', () => {
      clients.delete(client);
      broadcastEvent({
        type: 'presence',
        data: {
          userId: client.id,
          status: 'offline'
        }
      });
    });

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    // Clean up on connection close
    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(client);
    });
  });

  // Helper function to broadcast events to all connected clients
  const broadcastEvent = (event: SSEEvent, excludeClient?: string) => {
    const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;

    clients.forEach(client => {
      if (excludeClient && client.id === excludeClient) return;

      try {
        client.res.write(eventString);
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        clients.delete(client);
      }
    });
  };

  // Update presence status
  app.post("/api/presence", requireAuth, (req: Request, res: Response) => {
    const { status } = req.body;
    const userId = req.user?.id.toString();

    if (!userId || !['online', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    broadcastEvent({
      type: 'presence',
      data: { userId, status }
    }, userId);

    res.json({ success: true });
  });

  // Configure multer for handling file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Determine the upload path based on file type
      let uploadPath = path.join(process.env.HOME || process.cwd(), '.data', 'uploads');

      // If it's an avatar upload, use the avatars subdirectory
      if (file.fieldname === 'avatar') {
        uploadPath = path.join(process.env.HOME || process.cwd(), '.data', 'uploads', 'avatars');
      }

      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });

  const upload = multer({ 
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.env.HOME || process.cwd(), '.data', 'uploads')));

  // Add file upload to messages endpoint
  app.post("/api/messages", requireAuth, upload.single('file'), async (req: Request, res: Response) => {
    try {
      console.log('Starting message creation with file:', req.file);
      const { content, channelId, parentId, recipientId } = req.body;

      // Basic validation
      if (!content?.trim() && !req.file) {
        console.log('No content or file provided');
        return res.status(400).json({ error: "Message must contain either text content or a file" });
      }

      // Check if file exists and is readable
      if (req.file) {
        const filePath = path.join(process.env.HOME || process.cwd(), '.data', 'uploads', req.file.filename);
        console.log('Checking file at path:', filePath);

        if (!fs.existsSync(filePath)) {
          console.error('File does not exist at path:', filePath);
          return res.status(500).json({ error: "File upload failed - file not found" });
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        console.log('File stats:', {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          permissions: stats.mode,
          exists: fs.existsSync(filePath)
        });
      }

      // Create message data
      const messageData = {
        content: content?.trim() || '',
        senderId: req.user!.id,
        channelId: channelId ? parseInt(channelId, 10) : null,
        recipientId: recipientId ? parseInt(recipientId, 10) : null,
        parentId: parentId ? parseInt(parentId, 10) : null,
        ...(req.file && {
          fileName: req.file.originalname,
          fileUrl: `/uploads/${req.file.filename}`,
          fileSize: req.file.size,
          fileType: req.file.mimetype
        })
      };

      console.log('Creating message with data:', messageData);

      // Insert message
      const [message] = await db
        .insert(messages)
        .values(messageData)
        .returning();

      console.log('Created message:', message);

      // Get sender info
      const [sender] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      // Format message for response
      const formattedMessage = {
        id: message.id,
        content: message.content,
        channelId: message.channelId,
        recipientId: message.recipientId,
        parentId: message.parentId,
        timestamp: message.createdAt,
        sender: {
          id: sender.id,
          username: sender.username,
          displayName: sender.displayName,
          avatarUrl: sender.avatarUrl,
        },
        fileName: message.fileName,
        fileUrl: message.fileUrl,
        fileSize: message.fileSize,
        fileType: message.fileType
      };

      // Broadcast using SSE instead of WebSocket
      broadcastEvent({
        type: 'message',
        data: formattedMessage
      });

      // Also broadcast conversation update for DMs
      if (message.recipientId) {
        broadcastEvent({
          type: 'conversation_update',
          data: {
            senderId: req.user!.id,
            recipientId: message.recipientId
          }
        });
      }

      res.json(formattedMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Get messages for a channel or DM
  app.get("/api/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const { channelId, recipientId } = req.query;
      const currentUserId = req.user!.id;
      console.log('GET /api/messages - Query params:', { channelId, recipientId, currentUserId });

      let messageQuery;

      if (channelId) {
        const channelIdNum = parseInt(channelId as string, 10);
        if (isNaN(channelIdNum)) {
          return res.status(400).json({ error: "Invalid channel ID" });
        }
        // Get channel messages with replies
        messageQuery = db
          .select({
            message: messages,
            sender: {
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            }
          })
          .from(messages)
          .where(eq(messages.channelId, channelIdNum))
          .innerJoin(users, eq(messages.senderId, users.id))
          .orderBy(desc(messages.createdAt))
          .limit(100); // Increased limit to accommodate replies
      } else if (recipientId) {
        const recipientIdNum = parseInt(recipientId as string, 10);
        if (isNaN(recipientIdNum)) {
          console.error('Invalid recipient ID format:', recipientId);
          return res.status(400).json({ error: "Invalid recipient ID" });
        }
        console.log('Fetching DM messages between users:', { currentUserId, recipientIdNum });

        // Get DM messages with replies between current user and recipient
        messageQuery = db
          .select({
            message: messages,
            sender: {
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl,
            }
          })
          .from(messages)
          .where(
            or(
              and(
                eq(messages.senderId, currentUserId),
                eq(messages.recipientId, recipientIdNum)
              ),
              and(
                eq(messages.senderId, recipientIdNum),
                eq(messages.recipientId, currentUserId)
              )
            )
          )
          .innerJoin(users, eq(messages.senderId, users.id))
          .orderBy(desc(messages.createdAt))
          .limit(100); // Increased limit to accommodate replies
      } else {
        return res.status(400).json({ error: "Either channelId or recipientId is required" });
      }

      const results = await messageQuery;

      // Format messages and include reply counts
      const formattedMessages = await Promise.all(results.map(async ({ message, sender }) => {
        // Fetch reactions for this message
        const messageReactions = await db
          .select({
            id: reactions.id,
            messageId: reactions.messageId,
            userId: reactions.userId,
            emoji: reactions.emoji,
            username: users.username,
            displayName: users.displayName
          })
          .from(reactions)
          .leftJoin(users, eq(reactions.userId, users.id))
          .where(eq(reactions.messageId, message.id));

        return {
          id: message.id.toString(),
          content: message.content,
          channelId: message.channelId?.toString(),
          recipientId: message.recipientId?.toString(),
          parentId: message.parentId?.toString(),
          replyCount: message.replyCount || 0,
          timestamp: message.createdAt,
          sender: {
            id: sender.id,
            username: sender.username,
            displayName: sender.displayName,
            avatarUrl: sender.avatarUrl,
          },
          reactions: messageReactions,
          // Add file information
          fileName: message.fileName,
          fileUrl: message.fileUrl,
          fileSize: message.fileSize,
          fileType: message.fileType
        };
      }));

      // Get all message IDs to fetch their replies
      const messageIds = formattedMessages.map(m => parseInt(m.id));

      // Fetch all replies for these messages
      const repliesQuery = await db
        .select({
          message: messages,
          sender: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          }
        })
        .from(messages)
        .where(
          and(
            isNull(messages.channelId),
            isNull(messages.recipientId),
            sql`${messages.parentId} IN ${messageIds}`
          )
        )
        .innerJoin(users, eq(messages.senderId, users.id))
        .orderBy(desc(messages.createdAt));

      // Format replies
      const replies = repliesQuery.map(({ message, sender }) => ({
        id: message.id.toString(),
        content: message.content,
        parentId: message.parentId?.toString(),
        replyCount: message.replyCount || 0,
        timestamp: message.createdAt,
        sender: {
          id: sender.id,
          username: sender.username,
          displayName: sender.displayName,
          avatarUrl: sender.avatarUrl,
        }
      }));

      // Combine messages and replies
      const allMessages = [...formattedMessages, ...replies];

      res.json(allMessages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Add profile image upload route
  app.post('/api/users/me/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Create relative URL for the avatar
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Update user's avatar URL in database
      await db
        .update(users)
        .set({ avatarUrl })
        .where(eq(users.id, req.user!.id));

      // Return the full URL for immediate use
      res.json({ 
        avatarUrl,
        message: 'Profile image uploaded successfully' 
      });
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });

  // Get only channels where user is a member
  app.get("/api/channels", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Get channel memberships for the current user
      const memberships = await db
        .select()
        .from(channelMembers)
        .where(eq(channelMembers.userId, userId));

      // Get pending invitations for the current user
      const invitations = await db
        .select()
        .from(channelInvitations)
        .where(
          and(
            eq(channelInvitations.inviteeId, userId),
            eq(channelInvitations.status, 'pending')
          )
        );

      // Get only channels where user is a member
      const allChannels = await db
        .select()
        .from(channels)
        .where(
          inArray(
            channels.id,
            memberships.map(m => m.channelId)
          )
        );

      // Create maps for membership status and role
      const membershipMap = new Map(memberships.map(m => [m.channelId, { isMember: true, role: m.role }]));
      const invitationMap = new Map(invitations.map(i => [i.channelId, true]));

      // Combine the data
      const channelsWithStatus = allChannels.map(channel => ({
        ...channel,
        isMember: membershipMap.has(channel.id),
        role: membershipMap.get(channel.id)?.role || null,
        isPendingInvitation: invitationMap.has(channel.id)
      }));

      res.json(channelsWithStatus);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  // Get pending invitations for current user
  app.get('/api/channels/invitations', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      // Get pending invitations with channel and inviter details
      const invitations = await db
        .select({
          id: channelInvitations.id,
          channelId: channelInvitations.channelId,
          inviterId: channelInvitations.inviterId,
          inviteeId: channelInvitations.inviteeId,
          status: channelInvitations.status,
          createdAt: channelInvitations.createdAt,
          updatedAt: channelInvitations.updatedAt,
          channel: {
            id: channels.id,
            name: channels.name,
            description: channels.description,
            isPrivate: channels.isPrivate
          },
          inviter: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl
          }
        })
        .from(channelInvitations)
        .innerJoin(channels, eq(channelInvitations.channelId, channels.id))
        .innerJoin(users, eq(channelInvitations.inviterId, users.id))
        .where(
          and(
            eq(channelInvitations.inviteeId, userId),
            eq(channelInvitations.status, 'pending')
          )
        );

      res.json(invitations);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
      res.status(500).json({ error: 'Failed to fetch invitations' });
    }
  });

  // Get single channel
  app.get("/api/channels/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      res.json(channel);
    } catch (error) {
      console.error('Failed to fetch channel:', error);
      res.status(500).json({ error: "Failed to fetch channel" });
    }
  });

  // Update user profile
  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const { displayName, email, aboutMe, note } = req.body;

      // Update user profile in database
      await db
        .update(users)
        .set({
          displayName: displayName,
          email: email,
          aboutMe: aboutMe,
          note: note,
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, req.user!.id));

      // Return the updated user data
      const [updatedUser] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          email: users.email,
          aboutMe: users.aboutMe,
          note: users.note,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, req.user!.id))
        .limit(1);

      res.json(updatedUser);
    } catch (error) {
      console.error('Failed to update user profile:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  });

  // Get message suggestions (mock data for now)
  app.get("/api/suggestions", requireAuth, async (req: Request, res: Response) => {
    try {
      // Return mock suggestions based on input
      const suggestions = [
        "Thanks for the update!",
        "I'll look into that",
        "Great work everyone!"
      ];
      res.json(suggestions);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  // Get quick replies (mock data for now)
  app.get("/api/quick-replies", requireAuth, async (req: Request, res: Response) => {
    try {
      // Return mock quick replies
      const replies = [
        "Got it, thanks!",
        "I'll get back to you soon",
        "Can you provide more details?"
      ];
      res.json(replies);
    } catch (error) {
      console.error('Failed to get quick replies:', error);
      res.status(500).json({ error: "Failed to get quick replies" });
    }
  });

  // Search endpoint
  app.get("/api/search", requireAuth, async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      const type = req.query.type as string;
      const currentUserId = req.user!.id;

      if (!query) {
        return res.json({ messages: [], channels: [], users: [] });
      }

      // If type is 'users', only search users
      if (type === 'users') {
        const foundUsers = await db
          .select()
          .from(users)
          .where(
            and(
              sql`(LOWER(username) LIKE LOWER(${`%${query}%`}) OR LOWER(display_name) LIKE LOWER(${`%${query}%`}))`,
              sql`id != ${currentUserId}`
            )
          )
          .limit(10);

        return res.json({ messages: [], channels: [], users: foundUsers });
      }

      // Otherwise, search everything
      const foundUsers = await db
        .select()
        .from(users)
        .where(
          and(
            sql`(LOWER(username) LIKE LOWER(${`%${query}%`}) OR LOWER(display_name) LIKE LOWER(${`%${query}%`}))`,
            sql`id != ${currentUserId}`
          )
        )
        .limit(5);

      const foundChannels = await db
        .select()
        .from(channels)
        .where(
          and(
            sql`(LOWER(name) LIKE LOWER(${`%${query}%`}) OR LOWER(description) LIKE LOWER(${`%${query}%`}))`,
            eq(channels.isPrivate, false)  // Only show public channels in search
          )
        )
        .limit(5);

      const foundMessages = await db
        .select({
          message: messages,
          sender: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl
          }
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(sql`LOWER(content) LIKE LOWER(${`%${query}%`})`)
        .orderBy(desc(messages.createdAt))
        .limit(5);

      // Format messages
      const formattedMessages = foundMessages.map(({ message, sender }) => ({
        id: message.id,
        content: message.content,
        channelId: message.channelId,
        parentId: message.parentId,
        replyCount: message.replyCount,
        createdAt: message.createdAt,
        sender
      }));

      res.json({
        users: foundUsers,
        channels: foundChannels,
        messages: formattedMessages
      });
    } catch (error) {
      console.error('Search failed:', error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  // Create new channel
  app.post("/api/channels", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, isPublic } = req.body;
      const userId = req.user!.id;

      console.log('Creating channel with name:', name, 'isPublic:', isPublic);

      if (!name?.trim()) {
        console.log('Channel creation failed: Empty name');
        return res.status(400).json({ error: "Channel name is required" });
      }

      // Check if channel name already exists
      const [existingChannel] = await db
        .select()
        .from(channels)
        .where(eq(channels.name, name.trim()))
        .limit(1);

      if (existingChannel) {
        console.log('Channel creation failed: Name already exists:', name);
        return res.status(400).json({ error: "Channel name already exists" });
      }

      console.log('Creating new channel...');
      // Create new channel
      const [newChannel] = await db
        .insert(channels)
        .values({
          name: name.trim(),
          isPrivate: !isPublic, // Set isPrivate based on isPublic flag
        })
        .returning();

      console.log('Created channel:', newChannel);

      // Add creator as channel member with 'owner' role
      await db.insert(channelMembers).values({
        channelId: newChannel.id,
        userId: userId,
        role: 'owner'
      });

      // Return channel with membership status
      const channelWithStatus = {
        ...newChannel,
        isMember: true,
        role: 'owner',
        isPendingInvitation: false
      };

      console.log('Added creator as channel member');

      // Broadcast channel creation event
      broadcastEvent({
        type: 'channel',
        data: {
          action: 'created',
          channel: channelWithStatus
        }
      });

      console.log('Channel creation complete');
      res.json(channelWithStatus);
    } catch (error) {
      console.error('Failed to create channel. Error:', error);
      if (error instanceof Error) {
        res.status(500).json({ error: `Failed to create channel: ${error.message}` });
      } else {
        res.status(500).json({ error: "Failed to create channel: Unknown error" });
      }
    }
  });

  // Delete channel endpoint
  app.delete("/api/channels/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if channel exists and get channel details
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      // Check if user is channel owner
      const [membership] = await db
        .select()
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, userId),
            eq(channelMembers.role, 'owner')
          )
        )
        .limit(1);

      if (!membership) {
        return res.status(403).json({ error: "Only channel owners can delete channels" });
      }

      // First delete all messages in the channel
      await db
        .delete(messages)
        .where(eq(messages.channelId, channelId));

      // Delete all channel members
      await db
        .delete(channelMembers)
        .where(eq(channelMembers.channelId, channelId));

      // Delete all channel invitations
      await db
        .delete(channelInvitations)
        .where(eq(channelInvitations.channelId, channelId));

      // Then delete the channel
      await db
        .delete(channels)
        .where(eq(channels.id, channelId));

      // Broadcast channel deletion event
      broadcastEvent({
        type: 'channel',
        data: {
          action: 'deleted',
          channelId
        }
      });

      res.json({ message: "Channel deleted successfully" });
    } catch (error) {
      console.error('Failed to delete channel:', error);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }

    res.status(401).send("Not logged in");
  });

  // Get user by ID
  app.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          aboutMe: users.aboutMe,
          email: users.email,
          createdAt: sql`CAST(strftime('%s', ${users.createdAt}) AS INTEGER) * 1000`,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Convert the timestamp to ISO string
      const response = {
        ...user,
        createdAt: new Date(user.createdAt as number).toISOString()
      };

      console.log('User data:', response); // Add logging to see the response
      res.json(response);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all users
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(sql`id != ${req.user!.id}`); // Exclude current user

      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get active DM conversations
  app.get("/api/messages/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUserId = req.user!.id;
      console.log('\n=== Fetching conversations ===');
      console.log('Current user:', currentUserId);

      // Get users who have exchanged messages with current user
      const conversations = await db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          lastMessage: messages.content,
          timestamp: messages.createdAt
        })
        .from(messages)
        .innerJoin(
          users,
          or(
            and(
              eq(messages.senderId, currentUserId),
              eq(messages.recipientId, users.id)
            ),
            and(
              eq(messages.senderId, users.id),
              eq(messages.recipientId, currentUserId)
            )
          )
        )
        .where(
          and(
            isNull(messages.channelId),
            ne(users.id, currentUserId),
            isNotNull(users.username)
          )
        )
        .orderBy(desc(messages.createdAt));

      // Get unique conversations (one per user)
      const uniqueConversations = conversations.reduce((acc: any[], conv) => {
        if (!acc.find(c => c.userId === conv.userId)) {
          acc.push(conv);
        }
        return acc;
      }, []);

      console.log('Conversations found:', uniqueConversations.length);
      res.json(uniqueConversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Accept/reject invitation
  app.patch('/api/channels/invitations/:invitationId', requireAuth, async (req, res) => {
    try {
      const { invitationId } = req.params;
      const { action } = req.body;
      const userId = req.user!.id;

      if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const status = action === 'accept' ? 'accepted' : 'rejected';

      // Get invitation
      const [invitation] = await db
        .select()
        .from(channelInvitations)
        .where(
          and(
            eq(channelInvitations.id, parseInt(invitationId)),
            eq(channelInvitations.inviteeId, userId),
            eq(channelInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      // Update invitation status
      await db
        .update(channelInvitations)
        .set({ status })
        .where(eq(channelInvitations.id, parseInt(invitationId)));

      // If accepted, add user to channel members
      if (action === 'accept') {
        await db.insert(channelMembers).values({
          channelId: invitation.channelId,
          userId,
          role: 'member'
        });

        // Broadcast channel join event
        broadcastEvent({
          type: 'channel',
          data: {
            action: 'member_joined',
            channelId: invitation.channelId,
            userId
          }
        });
      }

      res.json({ status: 'success' });
    } catch (error) {
      console.error('Failed to update invitation:', error);
      res.status(500).json({ error: 'Failed to update invitation' });
    }
  });

  // Reaction routes
  app.post('/api/messages/:messageId/reactions', requireAuth, async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user!.id;

      console.log('Handling reaction:', { messageId, emoji, userId });

      if (!emoji) {
        return res.status(400).json({ error: 'Missing emoji' });
      }

      const messageIdNum = parseInt(messageId);
      if (isNaN(messageIdNum)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      // Check if reaction already exists
      const existingReactions = await db
        .select()
        .from(reactions)
        .where(
          and(
            eq(reactions.messageId, messageIdNum),
            eq(reactions.userId, userId),
            eq(reactions.emoji, emoji)
          )
        );

      console.log('Existing reactions:', existingReactions);

      if (existingReactions.length > 0) {
        // Remove reaction if it exists
        await db
          .delete(reactions)
          .where(
            and(
              eq(reactions.messageId, messageIdNum),
              eq(reactions.userId, userId),
              eq(reactions.emoji, emoji)
            )
          );
        console.log('Reaction removed');
      } else {
        // Add new reaction
        await db.insert(reactions).values({
          messageId: messageIdNum,
          userId,
          emoji
        });
        console.log('Reaction added');
      }

      // Return updated reactions with user details
      const updatedReactions = await db
        .select({
          id: reactions.id,
          messageId: reactions.messageId,
          userId: reactions.userId,
          emoji: reactions.emoji,
          username: users.username,
          displayName: users.displayName
        })
        .from(reactions)
        .leftJoin(users, eq(reactions.userId, users.id))
        .where(eq(reactions.messageId, messageIdNum));

      console.log('Updated reactions:', updatedReactions);
      res.json(updatedReactions);
    } catch (error) {
      console.error('Error handling reaction:', error);
      res.status(500).json({ error: 'Failed to handle reaction' });
    }
  });

  app.get('/api/messages/:messageId/reactions', requireAuth, async (req, res) => {
    try {
      const { messageId } = req.params;
      const messageIdNum = parseInt(messageId);
      if (isNaN(messageIdNum)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      // Get reactions with user details
      const messageReactions = await db
        .select({
          id: reactions.id,
          messageId: reactions.messageId,
          userId: reactions.userId,
          emoji: reactions.emoji,
          username: users.username,
          displayName: users.displayName
        })
        .from(reactions)
        .leftJoin(users, eq(reactions.userId, users.id))
        .where(eq(reactions.messageId, messageIdNum));

      console.log('Fetched reactions:', messageReactions);
      res.json(messageReactions);
    } catch (error) {
      console.error('Error fetching reactions:', error);
      res.status(500).json({ error: 'Failed to fetch reactions' });
    }
  });

  // Join channel
  app.post("/api/channels/:channelId/join", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const userId = req.user!.id;

      // Check if channel exists and is public
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      if (channel.isPrivate) {
        return res.status(403).json({ error: "Cannot join private channel without invitation" });
      }

      // Check if already a member
      const [existingMember] = await db
        .select()
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, userId)
          )
        )
        .limit(1);

      if (existingMember) {
        return res.status(400).json({ error: "Already a member of this channel" });
      }

      // Add user as channel member
      await db.insert(channelMembers).values({
        channelId,
        userId,
        role: 'member'
      });

      // Broadcast channel join event
      broadcastEvent({
        type: 'channel',
        data: {
          action: 'member_joined',
          channelId,
          userId
        }
      });

      res.json({ message: "Joined channel successfully" });
    } catch (error) {
      console.error('Failed to join channel:', error);
      res.status(500).json({ error: "Failed to join channel" });
    }
  });

  // Handle channel invitations
  app.post("/api/channels/:channelId/invitations", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const { inviteeId } = req.body;
      const inviterId = req.user!.id;

      // Check if channel exists
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      // Check if inviter is a member
      const [inviterMembership] = await db
        .select()
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, inviterId)
          )
        )
        .limit(1);

      if (!inviterMembership) {
        return res.status(403).json({ error: "Only channel members can send invitations" });
      }

      // Check if user is already a member
      const [existingMember] = await db
        .select()
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, inviteeId)
          )
        )
        .limit(1);

      if (existingMember) {
        return res.status(400).json({ error: "User is already a member of this channel" });
      }

      // Check if invitation already exists
      const [existingInvitation] = await db
        .select()
        .from(channelInvitations)
        .where(
          and(
            eq(channelInvitations.channelId, channelId),
            eq(channelInvitations.inviteeId, inviteeId),
            eq(channelInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (existingInvitation) {
        return res.status(400).json({ error: "Invitation already sent to this user" });
      }

      // Create invitation
      const [invitation] = await db
        .insert(channelInvitations)
        .values({
          channelId,
          inviterId,
          inviteeId: inviteeId,
          status: 'pending'
        })
        .returning();

      // Get channel and inviter details for the broadcast
      const [invitedChannel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      const [inviter] = await db
        .select()
        .from(users)
        .where(eq(users.id, inviterId))
        .limit(1);

      // Broadcast invitation event
      broadcastEvent({
        type: 'channel',
        data: {
          action: 'invitation_created',
          invitation: {
            ...invitation,
            channel: invitedChannel,
            inviter
          }
        }
      });

      res.json({ message: "Invitation sent successfully" });
    } catch (error) {
      console.error('Failed to send invitation:', error);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // Handle invitation responses (accept/reject)
  app.post("/api/channels/:channelId/invitations/:invitationId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { channelId, invitationId } = req.params;
      const { action } = req.body; // 'accept' or 'reject'
      const userId = req.user!.id;

      if (!['accept', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }

      // Check if invitation exists and is pending
      const [invitation] = await db
        .select()
        .from(channelInvitations)
        .where(
          and(
            eq(channelInvitations.id, parseInt(invitationId)),
            eq(channelInvitations.channelId, parseInt(channelId)),
            eq(channelInvitations.inviteeId, userId),
            eq(channelInvitations.status, 'pending')
          )
        )
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or already processed" });
      }

      // Update invitation status
      await db
        .update(channelInvitations)
        .set({ status: action === 'accept' ? 'accepted' : 'rejected' })
        .where(eq(channelInvitations.id, invitation.id));

      if (action === 'accept') {
        // Add user as channel member
        await db.insert(channelMembers).values({
          channelId: parseInt(channelId),
          userId,
          role: 'member'
        });

        // Broadcast channel join event
        broadcastEvent({
          type: 'channel',
          data: {
            action: 'member_joined',
            channelId: parseInt(channelId),
            userId
          }
        });
      }

      res.json({ message: `Invitation ${action}ed successfully` });
    } catch (error) {
      console.error(`Failed to ${req.body.action} invitation:`, error);
      res.status(500).json({ error: `Failed to ${req.body.action} invitation` });
    }
  });

  // Get channel details
  app.get("/api/channels/:channelId", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.channelId);

      // Get channel details
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      // Get members with their details
      const members = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          role: channelMembers.role
        })
        .from(channelMembers)
        .leftJoin(users, eq(channelMembers.userId, users.id))
        .where(eq(channelMembers.channelId, channelId));

      // Return channel with member details
      res.json({
        ...channel,
        members
      });
    } catch (error) {
      console.error('Error fetching channel:', error);
      res.status(500).json({ error: "Failed to fetch channel details" });
    }
  });

  // Leave channel endpoint
  app.post("/api/channels/:channelId/leave", requireAuth, async (req: Request, res: Response) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const userId = req.user!.id;

      // Check if channel exists
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      // Check if user is a member
      const [membership] = await db
        .select()
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, userId)
          )
        )
        .limit(1);

      if (!membership) {
        return res.status(400).json({ error: "Not a member of this channel" });
      }

      // Check if user is not the owner
      if (membership.role === 'owner') {
        return res.status(400).json({ error: "Channel owner cannot leave. Delete the channel instead." });
      }

      // Remove user from channel members
      await db
        .delete(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, channelId),
            eq(channelMembers.userId, userId)
          )
        );

      // Broadcast member left event
      broadcastEvent({
        type: 'channel',
        data: {
          action: 'member_left',
          channelId,
          userId
        }
      });

      res.json({ message: "Left channel successfully" });
    } catch (error) {
      console.error('Failed to leave channel:', error);
      res.status(500).json({ error: "Failed to leave channel" });
    }
  });

  return httpServer;
}