import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { messages, users, channels, channelMembers, channelInvitations, reactions, type SelectUser } from "../db/schema";
import { eq, desc, sql, and, isNull, or, ne, isNotNull, inArray } from "drizzle-orm";
import express from 'express';
import { setupAuth, sessionMiddleware } from "./auth";
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { generateAIResponse, generateMessageSuggestions, generateQuickReplies } from "./ai";
import { processDocument, processAllDocuments } from "./documentProcessor";

// Extend Express types
interface Request extends ExpressRequest {
  user?: SelectUser;
}

interface Response extends ExpressResponse {
  flush?: () => void;
}

// Extend WebSocket request type
interface WebSocketRequest extends IncomingMessage {
  user?: SelectUser;
}

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
  | 'conversation_update'
  | 'message_deleted'
  | 'reaction_update'
  | 'profile_update';

interface SSEEvent {
  type: SSEEventType;
  data: any;
}

// Keep track of connected SSE clients and their last query times
const clients = new Set<SSEClient>();
const userQueryTimes = new Map<number, number>();

// Rate limit for user queries (5 seconds)
const USER_QUERY_RATE_LIMIT = 5000;

// Keep track of WebSocket server state
let isWsServerReady = false;

// Auth middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
      fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const timestamp = Date.now();
      cb(null, `${timestamp}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure multer for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const avatarsDir = path.join(process.cwd(), 'data', 'avatars');
    fs.mkdirSync(avatarsDir, { recursive: true, mode: 0o755 });
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    cb(null, `${timestamp}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

export function registerRoutes(app: Express): Server {
  // Set up authentication routes and middleware
  setupAuth(app);

  const httpServer = createServer(app);

  // Set up WebSocket server attached to the HTTP server
  const wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: false
  });

  // Set server ready state when WebSocket server is initialized
  wss.on('listening', () => {
    console.log('WebSocket server is ready');
    isWsServerReady = true;
  });

  // Reset state if WebSocket server closes
  wss.on('close', () => {
    console.log('WebSocket server closed');
    isWsServerReady = false;
  });

  // Handle WebSocket upgrade
  httpServer.on('upgrade', async (request: WebSocketRequest, socket, head) => {
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

      // Parse session and authenticate user
      await new Promise((resolve) => sessionMiddleware(request as any, {} as any, resolve));

      // If no authenticated user, reject the connection
      if (!request.user) {
        console.log('Unauthorized WebSocket connection attempt');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Handle our application's WebSocket connections
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('Application WebSocket connection established for user:', request.user?.username);
        // Attach user info to WebSocket connection
        (ws as any).userId = request.user?.id;
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

                // Safe broadcast to all clients
                if (isWsServerReady && wss.clients) {
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
                    if (client?.readyState === WebSocket.OPEN) {
                      try {
                        client.send(JSON.stringify(reactionUpdate));
                      } catch (err) {
                        console.error('Error sending to client:', err);
                      }
                    }
                  });
                }
              });
            } catch (error) {
              console.error('Transaction error:', error);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'error',
                  data: { message: 'Failed to update reaction' }
                }));
              }
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

  // Helper function to broadcast events to all connected clients with rate limiting
  const broadcastEvent = (event: SSEEvent, excludeClient?: string) => {
    if (!clients || clients.size === 0) {
      console.log('No SSE clients connected, skipping broadcast');
      return;
    }

    // Rate limit check for user queries
    if (event.type === 'message' && event.data.sender?.id) {
      const now = Date.now();
      const lastQueryTime = userQueryTimes.get(event.data.sender.id) || 0;
      
      if (now - lastQueryTime < USER_QUERY_RATE_LIMIT) {
        console.log('Rate limiting user query:', event.data.sender.id);
        return;
      }
      
      userQueryTimes.set(event.data.sender.id, now);
    }

    const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    const deadClients = new Set<SSEClient>();

    clients.forEach(client => {
      if (!client?.res?.write || client.res.writableEnded || !client.res.writable) {
        deadClients.add(client);
        return;
      }

      if (excludeClient && client.id === excludeClient) return;

      try {
        client.res.write(eventString);
        client.res.flush?.(); // Flush the response if the method exists
      } catch (error) {
        console.error('Error broadcasting to SSE client:', error);
        deadClients.add(client);
      }
    });

    // Clean up dead clients
    deadClients.forEach(client => {
      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
        clients.delete(client);
      } catch (error) {
        console.error('Error cleaning up dead client:', error);
      }
    });
  };

  // SSE endpoint for real-time updates
  app.get("/api/events", requireAuth, (req: Request, res: Response) => {
    // Set appropriate headers for SSE
    const headers = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no'
    };

    res.writeHead(200, headers);

    // Enable response streaming
    if (res.flush) {
      res.flush();
    }

    // Helper function to send events to this client
    const sendEvent = (event: SSEEvent) => {
      if (res.writableEnded || !res.writable) return;
      try {
        const eventString = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        res.write(eventString);
        res.flush?.();
      } catch (error) {
        console.error('Error sending event to client:', error);
        cleanup();
      }
    };

    // Send initial connection event
    sendEvent({ type: 'connected', data: { userId: req.user?.id } });

    // Get Sarah's ID and send her presence status
    (async () => {
      const [sarah] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'ai-assistant'))
        .limit(1);

      if (sarah) {
        sendEvent({
          type: 'presence',
          data: {
            userId: sarah.id.toString(),
            status: 'online',
            lastSeen: new Date().toISOString()
          }
        });
      }
    })().catch(error => {
      console.error('Error sending Sarah presence status:', error);
    });

    // Send initial ping
    if (!res.writableEnded && res.writable) {
      res.write(':\n\n');
      res.flush?.();
    }

    // Keep connection alive with periodic pings
    const keepAlive = setInterval(() => {
      if (res.writableEnded || !res.writable) {
        cleanup();
        return;
      }
      try {
        res.write(':\n\n');
        res.flush?.();
      } catch (error) {
        console.error('Error sending keepalive:', error);
        cleanup();
      }
    }, 30000);

    // Add client to connected clients
    const client: SSEClient = { id: req.user!.id.toString(), res };
    clients.add(client);

    // Cleanup function
    const cleanup = () => {
      clearInterval(keepAlive);
      clients.delete(client);
      if (!res.writableEnded && res.writable) {
        try {
          res.end();
        } catch (error) {
          console.error('Error ending response:', error);
        }
      }
    };

    // Handle client disconnect
    req.on('close', () => {
      cleanup();
      // Broadcast offline status when client disconnects
      broadcastEvent({
        type: 'presence',
        data: {
          userId: client.id,
          status: 'offline',
          lastSeen: new Date().toISOString()
        }
      });
    });

    // Handle errors
    req.on('error', (error) => {
      console.error('SSE request error:', error);
      cleanup();
    });

    res.on('error', (error) => {
      console.error('SSE response error:', error);
      cleanup();
    });
  });

  // Update presence status
  app.post("/api/presence", requireAuth, (req: Request, res: Response) => {
    const { status } = req.body;
    const userId = req.user?.id.toString();

    if (!userId || !['online', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Broadcast presence update to all clients except the sender
    broadcastEvent({
      type: 'presence',
      data: { 
        userId, 
        status,
        lastSeen: new Date().toISOString()
      }
    }, userId);

    res.json({ success: true });
  });

  // Configure multer storage for files
  const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Create uploads directory with absolute path
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
      // Ensure directory exists with proper permissions
      fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
      console.log('Uploads directory:', uploadsDir);
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const ext = path.extname(file.originalname).toLowerCase();
      const timestamp = Date.now();
      const filename = `${timestamp}${ext}`;
      console.log('Generated filename:', filename);
      cb(null, filename);
    }
  });

  const fileUpload = multer({ 
    storage: fileStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  });

  // Serve uploaded files
  app.get('/api/uploads/:filename', (req, res) => {
    const fileName = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'data', 'uploads', fileName);
    
    console.log('File request:', {
      url: req.url,
      fileName,
      filePath,
      exists: fs.existsSync(filePath)
    });

    // If file doesn't exist, return 404 immediately
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify the file is within the uploads directory (prevent directory traversal)
    const normalizedFilePath = path.normalize(filePath);
    const normalizedUploadsDir = path.normalize(path.join(process.cwd(), 'data', 'uploads'));
    if (!normalizedFilePath.startsWith(normalizedUploadsDir)) {
      console.error('Invalid file path:', filePath);
      return res.status(403).json({ error: 'Invalid file path' });
    }

    // Set proper content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        res.type('image/jpeg');
        break;
      case '.png':
        res.type('image/png');
        break;
      case '.gif':
        res.type('image/gif');
        break;
      case '.webp':
        res.type('image/webp');
        break;
      default:
        res.type('application/octet-stream');
    }

    // Stream the file directly
    res.sendFile(filePath);
  });

  // Add file upload to messages endpoint
  app.post("/api/messages", requireAuth, fileUpload.single('file'), async (req: Request, res: Response) => {
    try {
      console.log('Starting message creation with file:', req.file);
      const { content, channelId, parentId, recipientId } = req.body;

      // Basic validation
      if (!content?.trim() && !req.file) {
        console.log('No content or file provided');
        return res.status(400).json({ error: "Message must contain either text content or a file" });
      }

      // Create message data
      const messageData = {
        content: content?.trim() || '',
        senderId: req.user!.id,
        channelId: channelId ? parseInt(channelId) : null,
        recipientId: recipientId ? parseInt(recipientId) : null,
        parentId: parentId ? parseInt(parentId) : null,
        ...(req.file && {
          fileName: req.file.originalname,
          fileUrl: `/api/uploads/${req.file.filename}`,
          fileSize: req.file.size,
          fileType: req.file.mimetype
        })
      };

      // Insert user's message
      const [message] = await db
        .insert(messages)
        .values(messageData)
        .returning();

      // Get AI assistant user
      const [aiAssistant] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'ai-assistant'))
        .limit(1);

      if (!aiAssistant) {
        console.error('AI assistant not found');
        return res.status(500).json({ error: 'AI assistant not found' });
      }

      // Check if this is a DM to Sarah or if the message mentions Sarah
      const isAIDM = recipientId && parseInt(recipientId) === aiAssistant.id;
      const mentionRegex = /@([^@\n]+?)(?=\s|$)/g;
      const mentions = content?.match(mentionRegex) || [];
      const hasSarahMention = mentions.some((mention: string) => {
        const mentionText = mention.slice(1).toLowerCase();
        return mentionText === 'sarah thompson' || 
               mentionText === 'sarah' || 
               mentionText === 'ai-assistant';
      });

      // Generate AI response if:
      // 1. Direct message to Sarah, or
      // 2. Message mentions Sarah in a channel, or
      // 3. Message is a reply to Sarah's message in a channel
      if (isAIDM || hasSarahMention || (message.parentId && channelId)) {
        console.log('Generating AI response for:', isAIDM ? 'DM' : hasSarahMention ? 'mention' : 'reply');
        
        // If it's a reply in a channel, check if the parent message is from Sarah
        let shouldRespond = isAIDM || hasSarahMention;
        if (message.parentId && channelId) {
          const [parentMessage] = await db
            .select()
            .from(messages)
            .where(eq(messages.id, message.parentId))
            .limit(1);
          
          if (parentMessage && parentMessage.senderId === aiAssistant.id) {
            shouldRespond = true;
          }
        }

        if (shouldRespond) {
          const aiResponse = await generateAIResponse(content, req.user!.id);

          const [aiMessage] = await db
            .insert(messages)
            .values({
              content: aiResponse,
              senderId: aiAssistant.id,
              channelId: channelId ? parseInt(channelId) : null,
              recipientId: isAIDM ? req.user!.id : null,
              parentId: (!isAIDM && !hasSarahMention) || message.parentId ? message.id : null
            })
            .returning();

          // Broadcast AI response
          const [formattedMessage] = await db
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
            .where(eq(messages.id, aiMessage.id))
            .innerJoin(users, eq(messages.senderId, users.id))
            .limit(1);

          broadcastEvent({
            type: 'message',
            data: {
              id: formattedMessage.message.id,
              content: formattedMessage.message.content,
              channelId: formattedMessage.message.channelId,
              recipientId: formattedMessage.message.recipientId,
              timestamp: formattedMessage.message.createdAt,
              sender: formattedMessage.sender
            }
          });
        }
      }

      // Get sender info for original message
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
          avatarUrl: sender.avatarUrl
        },
        fileName: message.fileName || null,
        fileUrl: message.fileUrl || null,
        fileSize: message.fileSize || null,
        fileType: message.fileType || null
      };

      // Broadcast using SSE
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
            message: {
              id: messages.id,
              content: messages.content,
              channelId: messages.channelId,
              recipientId: messages.recipientId,
              parentId: messages.parentId,
              replyCount: messages.replyCount,
              createdAt: messages.createdAt,
              fileName: messages.fileName,
              fileUrl: messages.fileUrl,
              fileSize: messages.fileSize,
              fileType: messages.fileType
            },
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
            message: {
              id: messages.id,
              content: messages.content,
              channelId: messages.channelId,
              recipientId: messages.recipientId,
              parentId: messages.parentId,
              replyCount: messages.replyCount,
              createdAt: messages.createdAt,
              fileName: messages.fileName,
              fileUrl: messages.fileUrl,
              fileSize: messages.fileSize,
              fileType: messages.fileType
            },
            sender: {
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl
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

  // Get message suggestions
  app.get("/api/suggestions", requireAuth, async (req: Request, res: Response) => {
    try {
      const { input } = req.query;
      const suggestions = await generateMessageSuggestions(
        parseInt(req.query.channelId as string),
        input as string
      );
      res.json(suggestions);
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  // Get quick replies
  app.get("/api/quick-replies", requireAuth, async (req: Request, res: Response) => {
    try {
      const { messageContent } = req.query;
      if (!messageContent) {
        return res.status(400).json({ error: "Message content is required" });
      }
      const replies = await generateQuickReplies(messageContent as string);
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
              ne(users.id, currentUserId) // Only exclude current user, allow ai-assistant
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
            ne(users.id, currentUserId) // Only exclude current user, allow ai-assistant
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
        dmId: message.recipientId,
        timestamp: message.createdAt,
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
        userId,
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

  // Get user by ID
  app.get("/api/users/:id", async (req, res) => {
    console.log('Fetching user profile:', { id: req.params.id });

    try {
      // Special case for Sarah's profile
      if (req.params.id === 'sarah') {
        console.log('Looking up Sarah profile...');
        const [sarah] = await db
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
          .where(eq(users.username, 'ai-assistant'))
          .limit(1);

        if (!sarah) {
          console.log("Sarah's profile not found");
          return res.status(404).json({ error: "Sarah's profile not found" });
        }

        const response = {
          ...sarah,
          createdAt: new Date(sarah.createdAt as number).toISOString()
        };

        console.log('Found Sarah:', response);
        return res.json(response);
      }

      // For all other users
      const parsedId = parseInt(req.params.id);
      console.log('Looking up user by ID:', { rawId: req.params.id, parsedId });

      // First let's check what users exist
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
        })
        .from(users)
        .orderBy(users.id);
      
      console.log('Available users:', JSON.stringify(allUsers, null, 2));

      // Check if the ID is valid
      if (isNaN(parsedId)) {
        console.log('Invalid user ID format:', req.params.id);
        return res.status(400).json({ error: "Invalid user ID format" });
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
        .where(eq(users.id, parsedId))
        .limit(1);

      if (!user) {
        console.log('User not found:', { parsedId, availableIds: allUsers.map(u => u.id) });
        return res.status(404).json({ error: "User not found" });
      }

      // Convert the timestamp to ISO string
      const response = {
        ...user,
        createdAt: new Date(user.createdAt as number).toISOString()
      };

      console.log('Found user:', response);
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
          aboutMe: users.aboutMe,
        })
        .from(users)
        .where(
          and(
            ne(users.id, req.user!.id),
            or(
              ne(users.username, 'ai-assistant'),
              eq(users.username, 'ai-assistant')
            )
          )
        ); // Include AI assistant but exclude current user

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

      // Get AI assistant
      const [aiBot] = await db
        .select({
          userId: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          lastMessage: sql<string | null>`NULL`,
          timestamp: sql<string | null>`NULL`
        })
        .from(users)
        .where(eq(users.username, 'ai-assistant'))
        .limit(1);

      // Get unique conversations (one per user)
      const uniqueConversations = conversations.reduce((acc: any[], conv) => {
        if (!acc.find(c => c.userId === conv.userId)) {
          acc.push(conv);
        }
        return acc;
      }, []);

      // Add AI bot to conversations if not already present
      if (aiBot && !uniqueConversations.find(c => c.userId === aiBot.userId)) {
        uniqueConversations.unshift(aiBot);
      }

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

      // Broadcast reaction update using SSE
      broadcastEvent({
        type: 'reaction_update',
        data: {
          messageId: messageIdNum,
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
      });

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
        .where(eq(channelInvitations.id, parseInt(invitationId)));

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

  // Delete message endpoint
  app.delete("/api/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = req.user!.id;

      // Check if message exists and belongs to the user
      const [message] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.id, messageId),
            eq(messages.senderId, userId)
          )
        )
        .limit(1);

      if (!message) {
        return res.status(404).json({ error: "Message not found or you don't have permission to delete it" });
      }

      // Check if this is a DM with AI assistant
      if (message.recipientId) {
        const [recipient] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, message.recipientId),
              eq(users.username, 'ai-assistant')
            )
          )
          .limit(1);

        if (recipient) {
          // Get all AI replies after this message
          const aiReplies = await db
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.senderId, message.recipientId),
                eq(messages.recipientId, userId),
                sql`created_at >= ${message.createdAt}`
              )
            );

          // Delete reactions for all AI replies
          if (aiReplies.length > 0) {
            await db
              .delete(reactions)
              .where(inArray(reactions.messageId, aiReplies.map(m => m.id)));

            // Delete all AI replies
            await db
              .delete(messages)
              .where(inArray(messages.id, aiReplies.map(m => m.id)));

            // Broadcast deletion events for all AI replies
            aiReplies.forEach(aiReply => {
              broadcastEvent({
                type: 'message_deleted',
                data: {
                  messageId: aiReply.id,
                  channelId: aiReply.channelId,
                  recipientId: aiReply.recipientId
                }
              });
            });
          }
        }
      }

      // Delete reactions for the original message
      await db
        .delete(reactions)
        .where(eq(reactions.messageId, messageId));

      // Delete the original message
      await db
        .delete(messages)
        .where(eq(messages.id, messageId));

      // Broadcast message deletion event
      broadcastEvent({
        type: 'message_deleted',
        data: {
          messageId,
          channelId: message.channelId,
          recipientId: message.recipientId
        }
      });

      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error('Failed to delete message:', error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // AI chat endpoint
  app.post("/api/ai/chat", requireAuth, async (req: Request, res: Response) => {
    try {
      const { content, channelId, parentId } = req.body;
      
      // Get AI bot user
      const [aiBot] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'ai-assistant'))
        .limit(1);

      if (!aiBot) {
        throw new Error('AI bot user not found');
      }

      // Process the message and generate AI response
      const aiResponse = await generateAIResponse(content);

      // Create the AI response message
      const [message] = await db
        .insert(messages)
        .values({
          content: aiResponse,
          senderId: aiBot.id,
          channelId: channelId ? parseInt(channelId) : null,
          recipientId: req.user!.id,
          parentId: parentId ? parseInt(parentId) : null
        })
        .returning();

      // Get full message data with sender info
      const [formattedMessage] = await db
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
        .where(eq(messages.id, message.id))
        .innerJoin(users, eq(messages.senderId, users.id))
        .limit(1);

      // Broadcast the AI response
      broadcastEvent({
        type: 'message',
        data: {
          id: formattedMessage.message.id,
          content: formattedMessage.message.content,
          channelId: formattedMessage.message.channelId,
          recipientId: formattedMessage.message.recipientId,
          timestamp: formattedMessage.message.createdAt,
          sender: formattedMessage.sender
        }
      });

      res.json({
        id: formattedMessage.message.id,
        content: formattedMessage.message.content,
        channelId: formattedMessage.message.channelId,
        recipientId: formattedMessage.message.recipientId,
        timestamp: formattedMessage.message.createdAt,
        sender: formattedMessage.sender
      });
    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: "Failed to process AI chat message" });
    }
  });

  // Upload training document endpoint
  app.post("/api/documents/upload", requireAuth, upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!req.file.mimetype.includes('pdf')) {
        return res.status(400).json({ error: "Only PDF files are supported" });
      }

      // Process the document
      await processDocument(req.file.path);

      res.json({ message: "Document processed successfully" });
    } catch (error) {
      console.error('Failed to process document:', error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  // Process all documents in uploads directory
  app.post("/api/documents/process-all", async (req: Request, res: Response) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
      const files = fs.readdirSync(uploadsDir);
      
      for (const file of files) {
        if (file.toLowerCase().endsWith('.pdf')) {
          const filePath = path.join(uploadsDir, file);
          await processDocument(filePath);
        }
      }
      
      res.json({ message: "All documents processed successfully" });
    } catch (error) {
      console.error("Error processing documents:", error);
      res.status(500).json({ error: "Failed to process documents" });
    }
  });

  // Document processing endpoint
  app.post("/api/documents/process", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('Starting document processing...');
      await processAllDocuments();
      res.json({ message: "Documents processed successfully" });
    } catch (error) {
      console.error('Error processing documents:', error);
      res.status(500).json({ error: "Failed to process documents" });
    }
  });

  // Debug route to list all users
  app.get("/api/debug/users", async (req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        })
        .from(users);
      
      res.json(allUsers);
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Upload avatar endpoint
  app.post("/api/users/me/avatar", requireAuth, avatarUpload.single('avatar'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Update user's avatar URL in database
      const avatarUrl = `/api/avatars/${req.file.filename}`;
      await db
        .update(users)
        .set({ avatarUrl })
        .where(eq(users.id, req.user!.id));

      // Broadcast profile update
      broadcastEvent({
        type: 'profile_update',
        data: {
          userId: req.user!.id,
          avatarUrl
        }
      });

      res.json({ avatarUrl });
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  // Serve avatar images
  app.get('/api/avatars/:filename', (req, res) => {
    const fileName = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'data', 'avatars', fileName);
    
    // If file doesn't exist, return 404
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Avatar not found' });
    }

    // Verify the file is within the avatars directory (prevent directory traversal)
    const normalizedFilePath = path.normalize(filePath);
    const normalizedAvatarsDir = path.normalize(path.join(process.cwd(), 'data', 'avatars'));
    if (!normalizedFilePath.startsWith(normalizedAvatarsDir)) {
      return res.status(403).json({ error: 'Invalid avatar path' });
    }

    // Set proper content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        res.type('image/jpeg');
        break;
      case '.png':
        res.type('image/png');
        break;
      case '.gif':
        res.type('image/gif');
        break;
      case '.webp':
        res.type('image/webp');
        break;
      default:
        res.type('application/octet-stream');
    }

    // Stream the file
    res.sendFile(filePath);
  });

  return httpServer;
}