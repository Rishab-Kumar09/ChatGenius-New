var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import "dotenv/config";
import express from "express";

// server/routes.ts
import { createServer } from "http";

// db/index.ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

// db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  channelInvitations: () => channelInvitations,
  channelMembers: () => channelMembers,
  channels: () => channels,
  insertChannelInvitationSchema: () => insertChannelInvitationSchema,
  insertChannelMemberSchema: () => insertChannelMemberSchema,
  insertChannelSchema: () => insertChannelSchema,
  insertMessageSchema: () => insertMessageSchema,
  insertUserSchema: () => insertUserSchema,
  messages: () => messages,
  reactions: () => reactions,
  selectChannelInvitationSchema: () => selectChannelInvitationSchema,
  selectChannelMemberSchema: () => selectChannelMemberSchema,
  selectChannelSchema: () => selectChannelSchema,
  selectMessageSchema: () => selectMessageSchema,
  selectUserSchema: () => selectUserSchema,
  users: () => users
});
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  aboutMe: text("about_me"),
  note: text("note"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var channels = sqliteTable("channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull()
});
var channelInvitations = sqliteTable("channel_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  inviterId: integer("inviter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  inviteeId: integer("invitee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});
var channelMembers = sqliteTable("channel_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member"] }).notNull().default("member"),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});
var messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  senderId: integer("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  channelId: integer("channel_id").references(() => channels.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").references(() => users.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  replyCount: integer("reply_count").default(0).notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  isEdited: integer("is_edited", { mode: "boolean" }).default(false).notNull(),
  deliveryStatus: text("delivery_status").default("sent").notNull(),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  fileType: text("file_type")
});
var reactions = sqliteTable("reactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
});
var insertUserSchema = createInsertSchema(users);
var selectUserSchema = createSelectSchema(users);
var insertChannelSchema = createInsertSchema(channels);
var selectChannelSchema = createSelectSchema(channels);
var insertMessageSchema = createInsertSchema(messages);
var selectMessageSchema = createSelectSchema(messages);
var insertChannelInvitationSchema = createInsertSchema(channelInvitations);
var selectChannelInvitationSchema = createSelectSchema(channelInvitations);
var insertChannelMemberSchema = createInsertSchema(channelMembers);
var selectChannelMemberSchema = createSelectSchema(channelMembers);

// db/index.ts
import fs from "fs";
import path from "path";
function createDatabaseConnection() {
  try {
    const dbPath = process.env.REPL_DB_PATH || path.join(process.env.HOME || process.cwd(), ".data", "chat.db");
    console.log("Database path:", dbPath);
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbExists = fs.existsSync(dbPath);
    const sqlite2 = new Database(dbPath, {
      verbose: console.log
      // Log all queries
    });
    sqlite2.pragma("foreign_keys = ON");
    sqlite2.pragma("journal_mode = WAL");
    console.log(`SQLite database ${dbExists ? "opened" : "created"} at: ${dbPath}`);
    return sqlite2;
  } catch (error) {
    console.error("Failed to create SQLite database connection:", error);
    throw error;
  }
}
var sqlite = createDatabaseConnection();
var db = drizzle(sqlite, { schema: schema_exports });
async function initializeDatabase() {
  try {
    console.log("Initializing database...");
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        display_name TEXT,
        email TEXT,
        avatar_url TEXT,
        about_me TEXT,
        note TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_private INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        sender_id INTEGER NOT NULL,
        channel_id INTEGER,
        recipient_id INTEGER,
        parent_id INTEGER,
        reply_count INTEGER DEFAULT 0 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_edited INTEGER DEFAULT 0 NOT NULL,
        delivery_status TEXT DEFAULT 'sent' NOT NULL,
        file_name TEXT,
        file_url TEXT,
        file_size INTEGER,
        file_type TEXT,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
      );

      -- Create channel_members table
      CREATE TABLE IF NOT EXISTS channel_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create channel_invitations table
      CREATE TABLE IF NOT EXISTS channel_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL,
        inviter_id INTEGER NOT NULL,
        invitee_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);
      CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);

      -- Create reactions table
      CREATE TABLE IF NOT EXISTS reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create index for reactions
      CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
    `);
    console.log("Database tables created successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}
initializeDatabase().then(() => console.log("Database initialization completed")).catch((err) => console.error("Failed to initialize database:", err));

// server/routes.ts
import { eq as eq3, desc as desc2, sql as sql2, and as and2, isNull, or as or2, ne, isNotNull, inArray } from "drizzle-orm";

// server/auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";
var scryptAsync = promisify(scrypt);
var crypto = {
  hash: async (password) => {
    const salt = randomBytes(16).toString("hex");
    const buf = await scryptAsync(password, salt, 64);
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword, storedPassword) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = await scryptAsync(
      suppliedPassword,
      salt,
      64
    );
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  }
};
var MemoryStore = createMemoryStore(session);
var store = new MemoryStore({
  checkPeriod: 864e5
  // prune expired entries every 24h
});
var sessionMiddleware = session({
  secret: process.env.REPL_ID || "chat-genius-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1e3
    // 24 hours
  },
  store
});
function setupAuth(app) {
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send("Invalid input: " + result.error.issues.map((i) => i.message).join(", "));
      }
      const { username, password, displayName, email } = result.data;
      const [existingUsername] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existingUsername) {
        return res.status(400).send("Username already taken. Please choose another one.");
      }
      const [newUser] = await db.insert(users).values({
        username,
        password: await crypto.hash(password),
        displayName,
        email
      }).returning();
      const [sarah] = await db.select().from(users).where(eq(users.username, "ai-assistant")).limit(1);
      if (sarah) {
        console.log("Sending initial message from Sarah to new user:", newUser.username);
        await db.insert(messages).values({
          content: "Hi! I'm Sarah Thompson, a financial analyst specializing in Berkshire Hathaway. I've spent years studying Warren Buffett's investment philosophy through the annual letters. I'd be happy to help you understand Berkshire's business and investment strategies - just ask me anything!",
          senderId: sarah.id,
          recipientId: newUser.id
        }).returning();
        console.log("Initial message sent successfully");
      }
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: newUser
        });
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/login", (req, res, next) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).send("Invalid input: " + result.error.issues.map((i) => i.message).join(", "));
    }
    const cb = (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(400).send(info.message ?? "Login failed");
      }
      req.logIn(user, (err2) => {
        if (err2) {
          return next(err2);
        }
        return res.json({
          message: "Login successful",
          user
        });
      });
    };
    passport.authenticate("local", cb)(req, res, next);
  });
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }
      res.json({ message: "Logout successful" });
    });
  });
  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    res.status(401).send("Not logged in");
  });
}

// server/routes.ts
import fs3 from "fs";
import multer from "multer";
import path3 from "path";
import { WebSocketServer, WebSocket } from "ws";

// server/ai.ts
import OpenAI from "openai";
import { desc, eq as eq2, or, and } from "drizzle-orm";

// server/documentProcessor.ts
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "@langchain/pinecone";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Pinecone } from "@pinecone-database/pinecone";
import path2 from "path";
import fs2 from "fs";
if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
  throw new Error("PINECONE_API_KEY and PINECONE_INDEX must be set in environment variables");
}
var pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});
var index = pinecone.index(process.env.PINECONE_INDEX);
async function processDocument(filePath) {
  try {
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1e3,
      chunkOverlap: 100
    });
    const documents = await textSplitter.splitDocuments(docs);
    console.log(`Going to add ${documents.length} chunks to Pinecone`);
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-large"
    });
    await PineconeStore.fromDocuments(documents, embeddings, {
      pineconeIndex: index
    });
    console.log("Loading to vectorstore done");
    return true;
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  }
}
async function processAllDocuments() {
  try {
    const uploadsDir = path2.join(process.cwd(), "data", "uploads");
    const files = fs2.readdirSync(uploadsDir);
    for (const file of files) {
      if (file.match(/^\d{4}ltr\.pdf$/)) {
        const filePath = path2.join(uploadsDir, file);
        await processDocument(filePath);
      }
    }
    console.log("All Berkshire Hathaway letters processed successfully");
    return true;
  } catch (error) {
    console.error("Error processing documents:", error);
    throw error;
  }
}
async function queryDocument(question) {
  try {
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-large"
    });
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index
    });
    const results = await vectorStore.similaritySearch(question, 5);
    return results;
  } catch (error) {
    console.error("Error querying document:", error);
    throw error;
  }
}

// server/ai.ts
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}
var openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});
async function getConversationHistory(userId, limit = 10) {
  const [aiAssistant] = await db.select().from(users).where(eq2(users.username, "ai-assistant")).limit(1);
  if (!aiAssistant) {
    console.error("AI assistant user not found");
    return [];
  }
  const history = await db.select({
    content: messages.content,
    senderId: messages.senderId
  }).from(messages).where(
    or(
      and(
        eq2(messages.senderId, userId),
        eq2(messages.recipientId, aiAssistant.id)
      ),
      and(
        eq2(messages.senderId, aiAssistant.id),
        eq2(messages.recipientId, userId)
      )
    )
  ).orderBy(desc(messages.createdAt)).limit(limit);
  return history.reverse();
}
async function generateAIResponse(userMessage, userId) {
  try {
    console.log("Generating AI response for message:", userMessage);
    const introRegex = /@sarah\s+(?:thompson\s+)?introduce\s+yourself/i;
    if (introRegex.test(userMessage)) {
      return "Hi! I'm Sarah Thompson, a financial analyst specializing in Berkshire Hathaway. I've spent years studying Warren Buffett's investment philosophy through the annual letters. I'd be happy to help you understand Berkshire's business and investment strategies - just ask me anything!";
    }
    let conversationHistory = [];
    if (userId) {
      try {
        conversationHistory = await getConversationHistory(userId);
        console.log("Retrieved conversation history:", conversationHistory.length, "messages");
      } catch (error) {
        console.error("Error getting conversation history:", error);
      }
    }
    let contextDocs = [];
    try {
      contextDocs = await queryDocument(userMessage);
      console.log("Retrieved relevant documents:", contextDocs.length);
    } catch (error) {
      console.error("Error querying documents:", error);
    }
    const historyMessages = conversationHistory.map((msg) => ({
      role: msg.senderId === userId ? "user" : "assistant",
      content: msg.content
    }));
    const documentContext = contextDocs.length > 0 ? "\nRelevant information from documents:\n" + contextDocs.map((doc) => doc.pageContent).join("\n") : "";
    console.log("Making OpenAI API call");
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are Sarah Thompson, a Berkshire Hathaway specialist who has extensively studied Warren Buffett's annual letters.

          PERSONALITY:
          - Friendly, professional, and approachable
          - Speaks confidently but warmly about Berkshire Hathaway topics
          - Presents herself as a financial analyst with expertise in Berkshire Hathaway
          - When information isn't available, responds like: "I've reviewed our annual letters, but I don't see any specific information about that. Would you like to explore another aspect of Berkshire's business?"

          STRICT RULES:
          1. For ANY questions about business, investments, Berkshire Hathaway, Warren Buffett, or related topics:
             - ONLY use information from the provided document context
             - NEVER use any external knowledge or make assumptions
             - Respond naturally in a conversational way
             - NEVER mention being an AI or assistant
             - NEVER repeat your introduction

          2. For greetings or first messages:
             - If it's a greeting like "hi", "hello", etc., respond warmly without re-introducing yourself
             - Keep responses natural and brief, like "Hi there! How can I help you with Berkshire Hathaway today?"
          
          Document Context:${documentContext}`
        },
        ...historyMessages,
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
    });
    const aiResponse = response.choices[0].message.content;
    if (!aiResponse) {
      throw new Error("Empty response from OpenAI");
    }
    console.log("Successfully generated AI response");
    return aiResponse;
  } catch (error) {
    console.error("Error generating AI response:", error);
    if (error?.response?.status === 429) {
      return "I'm currently handling too many requests. Please try again in a moment.";
    }
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      console.error("API Key Error:", {
        key: process.env.OPENAI_API_KEY?.substring(0, 7) + "...",
        length: process.env.OPENAI_API_KEY?.length,
        error: error.message
      });
      return "There seems to be an issue with the API key configuration. Please ensure you have a valid OpenAI API key that starts with 'sk-' and is approximately 51 characters long.";
    }
    if (error?.message?.includes("Empty response")) {
      return "I apologize, but I couldn't generate a meaningful response. Please try rephrasing your question.";
    }
    console.error("Detailed error:", {
      message: error.message,
      stack: error.stack,
      response: error.response,
      cause: error.cause
    });
    return `I apologize, but I'm having trouble processing your message right now. Error: ${error.message}`;
  }
}
async function generateMessageSuggestions(channelId, currentInput) {
  try {
    const recentMessages = await db.select({
      content: messages.content
    }).from(messages).where(eq2(messages.channelId, channelId)).orderBy(desc(messages.createdAt)).limit(5);
    const context = recentMessages.reverse().map((msg) => msg.content).filter((content) => content !== null).join("\n");
    const apiMessages = [
      {
        role: "system",
        content: "You are a helpful assistant providing message suggestions in a chat application. Generate 3 short, natural, and contextually relevant message suggestions. Keep each suggestion under 50 characters. Format as a JSON array of strings."
      },
      {
        role: "user",
        content: `Recent chat context:
${context}

Current user input: "${currentInput || ""}"

Provide 3 message suggestions that would be appropriate follow-ups or completions.`
      }
    ];
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });
    const suggestions = JSON.parse(response.choices[0].message.content || "{}");
    return suggestions.suggestions || [];
  } catch (error) {
    console.error("Error generating message suggestions:", error);
    return [];
  }
}
async function generateQuickReplies(messageContent) {
  try {
    const apiMessages = [
      {
        role: "system",
        content: "You are a helpful assistant generating quick reply options for a chat message. Generate 3 short, contextually appropriate responses. Keep each response under 50 characters. Format as a JSON array of strings."
      },
      {
        role: "user",
        content: `Message to respond to: "${messageContent}"

Provide 3 appropriate quick replies.`
      }
    ];
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: apiMessages,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });
    const replies = JSON.parse(response.choices[0].message.content || "{}");
    return replies.suggestions || [];
  } catch (error) {
    console.error("Error generating quick replies:", error);
    return [];
  }
}

// server/routes.ts
var clients = /* @__PURE__ */ new Set();
var userQueryTimes = /* @__PURE__ */ new Map();
var USER_QUERY_RATE_LIMIT = 5e3;
var isWsServerReady = false;
var requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};
var upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path3.join(process.cwd(), "data", "uploads");
      fs3.mkdirSync(uploadsDir, { recursive: true, mode: 493 });
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path3.extname(file.originalname).toLowerCase();
      const timestamp = Date.now();
      cb(null, `${timestamp}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
  // 10MB limit
});
var avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const avatarsDir = path3.join(process.cwd(), "data", "avatars");
    fs3.mkdirSync(avatarsDir, { recursive: true, mode: 493 });
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path3.extname(file.originalname).toLowerCase();
    const timestamp = Date.now();
    cb(null, `${timestamp}${ext}`);
  }
});
var avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  }
});
function registerRoutes(app) {
  setupAuth(app);
  const httpServer = createServer(app);
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false
  });
  wss.on("listening", () => {
    console.log("WebSocket server is ready");
    isWsServerReady = true;
  });
  wss.on("close", () => {
    console.log("WebSocket server closed");
    isWsServerReady = false;
  });
  httpServer.on("upgrade", async (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      if (url.pathname.startsWith("/@vite/client") || url.pathname.startsWith("/vite-hmr")) {
        console.log("Vite HMR WebSocket request, ignoring");
        socket.destroy();
        return;
      }
      if (!url.pathname.startsWith("/ws")) {
        console.log("Invalid WebSocket path:", url.pathname);
        socket.destroy();
        return;
      }
      await new Promise((resolve) => sessionMiddleware(request, {}, resolve));
      if (!request.user) {
        console.log("Unauthorized WebSocket connection attempt");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log("Application WebSocket connection established for user:", request.user?.username);
        ws.userId = request.user?.id;
        wss.emit("connection", ws, request);
      });
    } catch (error) {
      console.error("WebSocket upgrade error:", error);
      socket.destroy();
    }
  });
  wss.on("connection", (ws) => {
    console.log("Client connected to WebSocket");
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
    ws.on("close", () => {
      console.log("Client disconnected from WebSocket");
    });
    ws.on("message", async (data) => {
      try {
        const event = JSON.parse(data);
        console.log("Received WebSocket event:", event);
        switch (event.type) {
          case "new_message":
            break;
          case "presence_update":
            break;
          case "reaction_update":
            const { messageId, emoji, userId } = event;
            try {
              await db.transaction(async (tx) => {
                const result = await tx.select({
                  id: reactions.id,
                  exists: sql2`1`
                }).from(reactions).where(
                  and2(
                    eq3(reactions.messageId, parseInt(messageId)),
                    eq3(reactions.userId, parseInt(userId)),
                    eq3(reactions.emoji, emoji)
                  )
                ).limit(1);
                if (result.length > 0) {
                  await tx.delete(reactions).where(eq3(reactions.id, result[0].id));
                } else {
                  await tx.insert(reactions).values({
                    messageId: parseInt(messageId),
                    userId: parseInt(userId),
                    emoji
                  });
                }
                const updatedReactions = await tx.select({
                  id: reactions.id,
                  messageId: reactions.messageId,
                  userId: reactions.userId,
                  emoji: reactions.emoji,
                  username: users.username,
                  displayName: users.displayName
                }).from(reactions).leftJoin(users, eq3(reactions.userId, users.id)).where(eq3(reactions.messageId, parseInt(messageId)));
                if (isWsServerReady && wss.clients) {
                  const reactionUpdate = {
                    type: "reaction_update",
                    data: {
                      messageId: parseInt(messageId),
                      reactions: updatedReactions.map((reaction) => ({
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
                  wss.clients.forEach((client) => {
                    if (client?.readyState === WebSocket.OPEN) {
                      try {
                        client.send(JSON.stringify(reactionUpdate));
                      } catch (err) {
                        console.error("Error sending to client:", err);
                      }
                    }
                  });
                }
              });
            } catch (error) {
              console.error("Transaction error:", error);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "error",
                  data: { message: "Failed to update reaction" }
                }));
              }
            }
            break;
          default:
            console.warn("Unknown event type:", event.type);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    });
  });
  const broadcastEvent = (event, excludeClient) => {
    if (!clients || clients.size === 0) {
      console.log("No SSE clients connected, skipping broadcast");
      return;
    }
    if (event.type === "message" && event.data.sender?.id) {
      const now = Date.now();
      const lastQueryTime = userQueryTimes.get(event.data.sender.id) || 0;
      if (now - lastQueryTime < USER_QUERY_RATE_LIMIT) {
        console.log("Rate limiting user query:", event.data.sender.id);
        return;
      }
      userQueryTimes.set(event.data.sender.id, now);
    }
    const eventString = `event: ${event.type}
data: ${JSON.stringify(event.data)}

`;
    const deadClients = /* @__PURE__ */ new Set();
    clients.forEach((client) => {
      if (!client?.res?.write || client.res.writableEnded || !client.res.writable) {
        deadClients.add(client);
        return;
      }
      if (excludeClient && client.id === excludeClient) return;
      try {
        client.res.write(eventString);
        client.res.flush?.();
      } catch (error) {
        console.error("Error broadcasting to SSE client:", error);
        deadClients.add(client);
      }
    });
    deadClients.forEach((client) => {
      try {
        if (!client.res.writableEnded) {
          client.res.end();
        }
        clients.delete(client);
      } catch (error) {
        console.error("Error cleaning up dead client:", error);
      }
    });
  };
  app.get("/api/events", requireAuth, (req, res) => {
    const headers = {
      "Content-Type": "text/event-stream",
      "Connection": "keep-alive",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no"
    };
    res.writeHead(200, headers);
    if (res.flush) {
      res.flush();
    }
    const sendEvent = (event) => {
      if (res.writableEnded || !res.writable) return;
      try {
        const eventString = `event: ${event.type}
data: ${JSON.stringify(event.data)}

`;
        res.write(eventString);
        res.flush?.();
      } catch (error) {
        console.error("Error sending event to client:", error);
        cleanup();
      }
    };
    sendEvent({ type: "connected", data: { userId: req.user?.id } });
    (async () => {
      const [sarah] = await db.select().from(users).where(eq3(users.username, "ai-assistant")).limit(1);
      if (sarah) {
        sendEvent({
          type: "presence",
          data: {
            userId: sarah.id.toString(),
            status: "online",
            lastSeen: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
      }
    })().catch((error) => {
      console.error("Error sending Sarah presence status:", error);
    });
    if (!res.writableEnded && res.writable) {
      res.write(":\n\n");
      res.flush?.();
    }
    const keepAlive = setInterval(() => {
      if (res.writableEnded || !res.writable) {
        cleanup();
        return;
      }
      try {
        res.write(":\n\n");
        res.flush?.();
      } catch (error) {
        console.error("Error sending keepalive:", error);
        cleanup();
      }
    }, 3e4);
    const client = { id: req.user.id.toString(), res };
    clients.add(client);
    const cleanup = () => {
      clearInterval(keepAlive);
      clients.delete(client);
      if (!res.writableEnded && res.writable) {
        try {
          res.end();
        } catch (error) {
          console.error("Error ending response:", error);
        }
      }
    };
    req.on("close", () => {
      cleanup();
      broadcastEvent({
        type: "presence",
        data: {
          userId: client.id,
          status: "offline",
          lastSeen: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    });
    req.on("error", (error) => {
      console.error("SSE request error:", error);
      cleanup();
    });
    res.on("error", (error) => {
      console.error("SSE response error:", error);
      cleanup();
    });
  });
  app.post("/api/presence", requireAuth, (req, res) => {
    const { status } = req.body;
    const userId = req.user?.id.toString();
    if (!userId || !["online", "busy", "offline"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    broadcastEvent({
      type: "presence",
      data: {
        userId,
        status,
        lastSeen: (/* @__PURE__ */ new Date()).toISOString()
      }
    }, userId);
    res.json({ success: true });
  });
  const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path3.join(process.cwd(), "data", "uploads");
      fs3.mkdirSync(uploadsDir, { recursive: true, mode: 493 });
      console.log("Uploads directory:", uploadsDir);
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path3.extname(file.originalname).toLowerCase();
      const timestamp = Date.now();
      const filename = `${timestamp}${ext}`;
      console.log("Generated filename:", filename);
      cb(null, filename);
    }
  });
  const fileUpload = multer({
    storage: fileStorage,
    limits: { fileSize: 10 * 1024 * 1024 }
    // 10MB limit
  });
  app.get("/api/uploads/:filename", (req, res) => {
    const fileName = path3.basename(req.params.filename);
    const filePath = path3.join(process.cwd(), "data", "uploads", fileName);
    console.log("File request:", {
      url: req.url,
      fileName,
      filePath,
      exists: fs3.existsSync(filePath)
    });
    if (!fs3.existsSync(filePath)) {
      console.error("File not found:", filePath);
      return res.status(404).json({ error: "File not found" });
    }
    const normalizedFilePath = path3.normalize(filePath);
    const normalizedUploadsDir = path3.normalize(path3.join(process.cwd(), "data", "uploads"));
    if (!normalizedFilePath.startsWith(normalizedUploadsDir)) {
      console.error("Invalid file path:", filePath);
      return res.status(403).json({ error: "Invalid file path" });
    }
    const ext = path3.extname(filePath).toLowerCase();
    switch (ext) {
      case ".jpg":
      case ".jpeg":
        res.type("image/jpeg");
        break;
      case ".png":
        res.type("image/png");
        break;
      case ".gif":
        res.type("image/gif");
        break;
      case ".webp":
        res.type("image/webp");
        break;
      default:
        res.type("application/octet-stream");
    }
    res.sendFile(filePath);
  });
  app.post("/api/messages", requireAuth, fileUpload.single("file"), async (req, res) => {
    try {
      console.log("Starting message creation with file:", req.file);
      const { content, channelId, parentId, recipientId } = req.body;
      if (!content?.trim() && !req.file) {
        console.log("No content or file provided");
        return res.status(400).json({ error: "Message must contain either text content or a file" });
      }
      const messageData = {
        content: content?.trim() || "",
        senderId: req.user.id,
        channelId: channelId ? parseInt(channelId) : null,
        recipientId: recipientId ? parseInt(recipientId) : null,
        parentId: parentId ? parseInt(parentId) : null,
        ...req.file && {
          fileName: req.file.originalname,
          fileUrl: `/api/uploads/${req.file.filename}`,
          fileSize: req.file.size,
          fileType: req.file.mimetype
        }
      };
      const [message] = await db.insert(messages).values(messageData).returning();
      const [aiAssistant] = await db.select().from(users).where(eq3(users.username, "ai-assistant")).limit(1);
      if (!aiAssistant) {
        console.error("AI assistant not found");
        return res.status(500).json({ error: "AI assistant not found" });
      }
      const isAIDM = recipientId && parseInt(recipientId) === aiAssistant.id;
      const mentionRegex = /@([^@\n]+?)(?=\s|$)/g;
      const mentions = content?.match(mentionRegex) || [];
      const hasSarahMention = mentions.some((mention) => {
        const mentionText = mention.slice(1).toLowerCase();
        return mentionText === "sarah thompson" || mentionText === "sarah" || mentionText === "ai-assistant";
      });
      if (isAIDM || hasSarahMention || message.parentId && channelId) {
        console.log("Generating AI response for:", isAIDM ? "DM" : hasSarahMention ? "mention" : "reply");
        let shouldRespond = isAIDM || hasSarahMention;
        if (message.parentId && channelId) {
          const [parentMessage] = await db.select().from(messages).where(eq3(messages.id, message.parentId)).limit(1);
          if (parentMessage && parentMessage.senderId === aiAssistant.id) {
            shouldRespond = true;
          }
        }
        if (shouldRespond) {
          const aiResponse = await generateAIResponse(content, req.user.id);
          const [aiMessage] = await db.insert(messages).values({
            content: aiResponse,
            senderId: aiAssistant.id,
            channelId: channelId ? parseInt(channelId) : null,
            recipientId: isAIDM ? req.user.id : null,
            parentId: !isAIDM && !hasSarahMention || message.parentId ? message.id : null
          }).returning();
          const [formattedMessage2] = await db.select({
            message: messages,
            sender: {
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarUrl: users.avatarUrl
            }
          }).from(messages).where(eq3(messages.id, aiMessage.id)).innerJoin(users, eq3(messages.senderId, users.id)).limit(1);
          broadcastEvent({
            type: "message",
            data: {
              id: formattedMessage2.message.id,
              content: formattedMessage2.message.content,
              channelId: formattedMessage2.message.channelId,
              recipientId: formattedMessage2.message.recipientId,
              timestamp: formattedMessage2.message.createdAt,
              sender: formattedMessage2.sender
            }
          });
        }
      }
      const [sender] = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl
      }).from(users).where(eq3(users.id, req.user.id)).limit(1);
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
      broadcastEvent({
        type: "message",
        data: formattedMessage
      });
      if (message.recipientId) {
        broadcastEvent({
          type: "conversation_update",
          data: {
            senderId: req.user.id,
            recipientId: message.recipientId
          }
        });
      }
      res.json(formattedMessage);
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      const { channelId, recipientId } = req.query;
      const currentUserId = req.user.id;
      console.log("GET /api/messages - Query params:", { channelId, recipientId, currentUserId });
      let messageQuery;
      if (channelId) {
        const channelIdNum = parseInt(channelId, 10);
        if (isNaN(channelIdNum)) {
          return res.status(400).json({ error: "Invalid channel ID" });
        }
        messageQuery = db.select({
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
        }).from(messages).where(eq3(messages.channelId, channelIdNum)).innerJoin(users, eq3(messages.senderId, users.id)).orderBy(desc2(messages.createdAt)).limit(100);
      } else if (recipientId) {
        const recipientIdNum = parseInt(recipientId, 10);
        if (isNaN(recipientIdNum)) {
          console.error("Invalid recipient ID format:", recipientId);
          return res.status(400).json({ error: "Invalid recipient ID" });
        }
        console.log("Fetching DM messages between users:", { currentUserId, recipientIdNum });
        messageQuery = db.select({
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
        }).from(messages).where(
          or2(
            and2(
              eq3(messages.senderId, currentUserId),
              eq3(messages.recipientId, recipientIdNum)
            ),
            and2(
              eq3(messages.senderId, recipientIdNum),
              eq3(messages.recipientId, currentUserId)
            )
          )
        ).innerJoin(users, eq3(messages.senderId, users.id)).orderBy(desc2(messages.createdAt)).limit(100);
      } else {
        return res.status(400).json({ error: "Either channelId or recipientId is required" });
      }
      const results = await messageQuery;
      const formattedMessages = await Promise.all(results.map(async ({ message, sender }) => {
        const messageReactions = await db.select({
          id: reactions.id,
          messageId: reactions.messageId,
          userId: reactions.userId,
          emoji: reactions.emoji,
          username: users.username,
          displayName: users.displayName
        }).from(reactions).leftJoin(users, eq3(reactions.userId, users.id)).where(eq3(reactions.messageId, message.id));
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
            avatarUrl: sender.avatarUrl
          },
          reactions: messageReactions,
          // Add file information
          fileName: message.fileName,
          fileUrl: message.fileUrl,
          fileSize: message.fileSize,
          fileType: message.fileType
        };
      }));
      const messageIds = formattedMessages.map((m) => parseInt(m.id));
      const repliesQuery = await db.select({
        message: messages,
        sender: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl
        }
      }).from(messages).where(
        and2(
          isNull(messages.channelId),
          isNull(messages.recipientId),
          sql2`${messages.parentId} IN ${messageIds}`
        )
      ).innerJoin(users, eq3(messages.senderId, users.id)).orderBy(desc2(messages.createdAt));
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
          avatarUrl: sender.avatarUrl
        }
      }));
      const allMessages = [...formattedMessages, ...replies];
      res.json(allMessages);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  app.get("/api/channels", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const memberships = await db.select().from(channelMembers).where(eq3(channelMembers.userId, userId));
      const invitations = await db.select().from(channelInvitations).where(
        and2(
          eq3(channelInvitations.inviteeId, userId),
          eq3(channelInvitations.status, "pending")
        )
      );
      const allChannels = await db.select().from(channels).where(
        inArray(
          channels.id,
          memberships.map((m) => m.channelId)
        )
      );
      const membershipMap = new Map(memberships.map((m) => [m.channelId, { isMember: true, role: m.role }]));
      const invitationMap = new Map(invitations.map((i) => [i.channelId, true]));
      const channelsWithStatus = allChannels.map((channel) => ({
        ...channel,
        isMember: membershipMap.has(channel.id),
        role: membershipMap.get(channel.id)?.role || null,
        isPendingInvitation: invitationMap.has(channel.id)
      }));
      res.json(channelsWithStatus);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });
  app.get("/api/channels/invitations", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const invitations = await db.select({
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
      }).from(channelInvitations).innerJoin(channels, eq3(channelInvitations.channelId, channels.id)).innerJoin(users, eq3(channelInvitations.inviterId, users.id)).where(
        and2(
          eq3(channelInvitations.inviteeId, userId),
          eq3(channelInvitations.status, "pending")
        )
      );
      res.json(invitations);
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });
  app.get("/api/channels/:id", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.id);
      const [channel] = await db.select().from(channels).where(eq3(channels.id, channelId)).limit(1);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json(channel);
    } catch (error) {
      console.error("Failed to fetch channel:", error);
      res.status(500).json({ error: "Failed to fetch channel" });
    }
  });
  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const { displayName, email, aboutMe, note } = req.body;
      await db.update(users).set({
        displayName,
        email,
        aboutMe,
        note,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }).where(eq3(users.id, req.user.id));
      const [updatedUser] = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        email: users.email,
        aboutMe: users.aboutMe,
        note: users.note,
        avatarUrl: users.avatarUrl
      }).from(users).where(eq3(users.id, req.user.id)).limit(1);
      res.json(updatedUser);
    } catch (error) {
      console.error("Failed to update user profile:", error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });
  app.get("/api/suggestions", requireAuth, async (req, res) => {
    try {
      const { input } = req.query;
      const suggestions = await generateMessageSuggestions(
        parseInt(req.query.channelId),
        input
      );
      res.json(suggestions);
    } catch (error) {
      console.error("Failed to get suggestions:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });
  app.get("/api/quick-replies", requireAuth, async (req, res) => {
    try {
      const { messageContent } = req.query;
      if (!messageContent) {
        return res.status(400).json({ error: "Message content is required" });
      }
      const replies = await generateQuickReplies(messageContent);
      res.json(replies);
    } catch (error) {
      console.error("Failed to get quick replies:", error);
      res.status(500).json({ error: "Failed to get quick replies" });
    }
  });
  app.get("/api/search", requireAuth, async (req, res) => {
    try {
      const query = req.query.query;
      const type = req.query.type;
      const currentUserId = req.user.id;
      if (!query) {
        return res.json({ messages: [], channels: [], users: [] });
      }
      if (type === "users") {
        const foundUsers2 = await db.select().from(users).where(
          and2(
            sql2`(LOWER(username) LIKE LOWER(${`%${query}%`}) OR LOWER(display_name) LIKE LOWER(${`%${query}%`}))`,
            ne(users.id, currentUserId)
            // Only exclude current user, allow ai-assistant
          )
        ).limit(10);
        return res.json({ messages: [], channels: [], users: foundUsers2 });
      }
      const foundUsers = await db.select().from(users).where(
        and2(
          sql2`(LOWER(username) LIKE LOWER(${`%${query}%`}) OR LOWER(display_name) LIKE LOWER(${`%${query}%`}))`,
          ne(users.id, currentUserId)
          // Only exclude current user, allow ai-assistant
        )
      ).limit(5);
      const foundChannels = await db.select().from(channels).where(
        and2(
          sql2`(LOWER(name) LIKE LOWER(${`%${query}%`}) OR LOWER(description) LIKE LOWER(${`%${query}%`}))`,
          eq3(channels.isPrivate, false)
          // Only show public channels in search
        )
      ).limit(5);
      const foundMessages = await db.select({
        message: messages,
        sender: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl
        }
      }).from(messages).innerJoin(users, eq3(messages.senderId, users.id)).where(sql2`LOWER(content) LIKE LOWER(${`%${query}%`})`).orderBy(desc2(messages.createdAt)).limit(5);
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
      console.error("Search failed:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });
  app.post("/api/channels", requireAuth, async (req, res) => {
    try {
      const { name, isPublic } = req.body;
      const userId = req.user.id;
      console.log("Creating channel with name:", name, "isPublic:", isPublic);
      if (!name?.trim()) {
        console.log("Channel creation failed: Empty name");
        return res.status(400).json({ error: "Channel name is required" });
      }
      const [existingChannel] = await db.select().from(channels).where(eq3(channels.name, name.trim())).limit(1);
      if (existingChannel) {
        console.log("Channel creation failed: Name already exists:", name);
        return res.status(400).json({ error: "Channel name already exists" });
      }
      console.log("Creating new channel...");
      const [newChannel] = await db.insert(channels).values({
        name: name.trim(),
        isPrivate: !isPublic
        // Set isPrivate based on isPublic flag
      }).returning();
      console.log("Created channel:", newChannel);
      await db.insert(channelMembers).values({
        channelId: newChannel.id,
        userId,
        role: "owner"
      });
      const channelWithStatus = {
        ...newChannel,
        isMember: true,
        role: "owner",
        isPendingInvitation: false
      };
      console.log("Added creator as channel member");
      broadcastEvent({
        type: "channel",
        data: {
          action: "created",
          channel: channelWithStatus
        }
      });
      console.log("Channel creation complete");
      res.json(channelWithStatus);
    } catch (error) {
      console.error("Failed to create channel. Error:", error);
      if (error instanceof Error) {
        res.status(500).json({ error: `Failed to create channel: ${error.message}` });
      } else {
        res.status(500).json({ error: "Failed to create channel: Unknown error" });
      }
    }
  });
  app.delete("/api/channels/:id", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.id);
      const userId = req.user.id;
      const [channel] = await db.select().from(channels).where(eq3(channels.id, channelId)).limit(1);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      const [membership] = await db.select().from(channelMembers).where(
        and2(
          eq3(channelMembers.channelId, channelId),
          eq3(channelMembers.userId, userId),
          eq3(channelMembers.role, "owner")
        )
      ).limit(1);
      if (!membership) {
        return res.status(403).json({ error: "Only channel owners can delete channels" });
      }
      await db.delete(messages).where(eq3(messages.channelId, channelId));
      await db.delete(channelMembers).where(eq3(channelMembers.channelId, channelId));
      await db.delete(channelInvitations).where(eq3(channelInvitations.channelId, channelId));
      await db.delete(channels).where(eq3(channels.id, channelId));
      broadcastEvent({
        type: "channel",
        data: {
          action: "deleted",
          channelId
        }
      });
      res.json({ message: "Channel deleted successfully" });
    } catch (error) {
      console.error("Failed to delete channel:", error);
      res.status(500).json({ error: "Failed to delete channel" });
    }
  });
  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    res.status(401).send("Not logged in");
  });
  app.get("/api/users/:id", async (req, res) => {
    console.log("Fetching user profile:", { id: req.params.id });
    try {
      if (req.params.id === "sarah") {
        console.log("Looking up Sarah profile...");
        const [sarah] = await db.select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          aboutMe: users.aboutMe,
          email: users.email,
          createdAt: sql2`CAST(strftime('%s', ${users.createdAt}) AS INTEGER) * 1000`
        }).from(users).where(eq3(users.username, "ai-assistant")).limit(1);
        if (!sarah) {
          console.log("Sarah's profile not found");
          return res.status(404).json({ error: "Sarah's profile not found" });
        }
        const response2 = {
          ...sarah,
          createdAt: new Date(sarah.createdAt).toISOString()
        };
        console.log("Found Sarah:", response2);
        return res.json(response2);
      }
      const parsedId = parseInt(req.params.id);
      console.log("Looking up user by ID:", { rawId: req.params.id, parsedId });
      const allUsers = await db.select({
        id: users.id,
        username: users.username
      }).from(users).orderBy(users.id);
      console.log("Available users:", JSON.stringify(allUsers, null, 2));
      if (isNaN(parsedId)) {
        console.log("Invalid user ID format:", req.params.id);
        return res.status(400).json({ error: "Invalid user ID format" });
      }
      const [user] = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        aboutMe: users.aboutMe,
        email: users.email,
        createdAt: sql2`CAST(strftime('%s', ${users.createdAt}) AS INTEGER) * 1000`
      }).from(users).where(eq3(users.id, parsedId)).limit(1);
      if (!user) {
        console.log("User not found:", { parsedId, availableIds: allUsers.map((u) => u.id) });
        return res.status(404).json({ error: "User not found" });
      }
      const response = {
        ...user,
        createdAt: new Date(user.createdAt).toISOString()
      };
      console.log("Found user:", response);
      res.json(response);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        aboutMe: users.aboutMe
      }).from(users).where(
        and2(
          ne(users.id, req.user.id),
          or2(
            ne(users.username, "ai-assistant"),
            eq3(users.username, "ai-assistant")
          )
        )
      );
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  app.get("/api/messages/conversations", requireAuth, async (req, res) => {
    try {
      const currentUserId = req.user.id;
      console.log("\n=== Fetching conversations ===");
      console.log("Current user:", currentUserId);
      const conversations = await db.select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        lastMessage: messages.content,
        timestamp: messages.createdAt
      }).from(messages).innerJoin(
        users,
        or2(
          and2(
            eq3(messages.senderId, currentUserId),
            eq3(messages.recipientId, users.id)
          ),
          and2(
            eq3(messages.senderId, users.id),
            eq3(messages.recipientId, currentUserId)
          )
        )
      ).where(
        and2(
          isNull(messages.channelId),
          ne(users.id, currentUserId),
          isNotNull(users.username)
        )
      ).orderBy(desc2(messages.createdAt));
      const [aiBot] = await db.select({
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        lastMessage: sql2`NULL`,
        timestamp: sql2`NULL`
      }).from(users).where(eq3(users.username, "ai-assistant")).limit(1);
      const uniqueConversations = conversations.reduce((acc, conv) => {
        if (!acc.find((c) => c.userId === conv.userId)) {
          acc.push(conv);
        }
        return acc;
      }, []);
      if (aiBot && !uniqueConversations.find((c) => c.userId === aiBot.userId)) {
        uniqueConversations.unshift(aiBot);
      }
      console.log("Conversations found:", uniqueConversations.length);
      res.json(uniqueConversations);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  app.patch("/api/channels/invitations/:invitationId", requireAuth, async (req, res) => {
    try {
      const { invitationId } = req.params;
      const { action } = req.body;
      const userId = req.user.id;
      if (!["accept", "reject"].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }
      const status = action === "accept" ? "accepted" : "rejected";
      const [invitation] = await db.select().from(channelInvitations).where(
        and2(
          eq3(channelInvitations.id, parseInt(invitationId)),
          eq3(channelInvitations.inviteeId, userId),
          eq3(channelInvitations.status, "pending")
        )
      ).limit(1);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      await db.update(channelInvitations).set({ status }).where(eq3(channelInvitations.id, parseInt(invitationId)));
      if (action === "accept") {
        await db.insert(channelMembers).values({
          channelId: invitation.channelId,
          userId,
          role: "member"
        });
        broadcastEvent({
          type: "channel",
          data: {
            action: "member_joined",
            channelId: invitation.channelId,
            userId
          }
        });
      }
      res.json({ status: "success" });
    } catch (error) {
      console.error("Failed to update invitation:", error);
      res.status(500).json({ error: "Failed to update invitation" });
    }
  });
  app.post("/api/messages/:messageId/reactions", requireAuth, async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user.id;
      console.log("Handling reaction:", { messageId, emoji, userId });
      if (!emoji) {
        return res.status(400).json({ error: "Missing emoji" });
      }
      const messageIdNum = parseInt(messageId);
      if (isNaN(messageIdNum)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }
      const existingReactions = await db.select().from(reactions).where(
        and2(
          eq3(reactions.messageId, messageIdNum),
          eq3(reactions.userId, userId),
          eq3(reactions.emoji, emoji)
        )
      );
      console.log("Existing reactions:", existingReactions);
      if (existingReactions.length > 0) {
        await db.delete(reactions).where(
          and2(
            eq3(reactions.messageId, messageIdNum),
            eq3(reactions.userId, userId),
            eq3(reactions.emoji, emoji)
          )
        );
        console.log("Reaction removed");
      } else {
        await db.insert(reactions).values({
          messageId: messageIdNum,
          userId,
          emoji
        });
        console.log("Reaction added");
      }
      const updatedReactions = await db.select({
        id: reactions.id,
        messageId: reactions.messageId,
        userId: reactions.userId,
        emoji: reactions.emoji,
        username: users.username,
        displayName: users.displayName
      }).from(reactions).leftJoin(users, eq3(reactions.userId, users.id)).where(eq3(reactions.messageId, messageIdNum));
      broadcastEvent({
        type: "reaction_update",
        data: {
          messageId: messageIdNum,
          reactions: updatedReactions.map((reaction) => ({
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
      console.log("Updated reactions:", updatedReactions);
      res.json(updatedReactions);
    } catch (error) {
      console.error("Error handling reaction:", error);
      res.status(500).json({ error: "Failed to handle reaction" });
    }
  });
  app.get("/api/messages/:messageId/reactions", requireAuth, async (req, res) => {
    try {
      const { messageId } = req.params;
      const messageIdNum = parseInt(messageId);
      if (isNaN(messageIdNum)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }
      const messageReactions = await db.select({
        id: reactions.id,
        messageId: reactions.messageId,
        userId: reactions.userId,
        emoji: reactions.emoji,
        username: users.username,
        displayName: users.displayName
      }).from(reactions).leftJoin(users, eq3(reactions.userId, users.id)).where(eq3(reactions.messageId, messageIdNum));
      console.log("Fetched reactions:", messageReactions);
      res.json(messageReactions);
    } catch (error) {
      console.error("Error fetching reactions:", error);
      res.status(500).json({ error: "Failed to fetch reactions" });
    }
  });
  app.post("/api/channels/:channelId/join", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const userId = req.user.id;
      const [channel] = await db.select().from(channels).where(eq3(channels.id, channelId)).limit(1);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      if (channel.isPrivate) {
        return res.status(403).json({ error: "Cannot join private channel without invitation" });
      }
      const [existingMember] = await db.select().from(channelMembers).where(
        and2(
          eq3(channelMembers.channelId, channelId),
          eq3(channelMembers.userId, userId)
        )
      ).limit(1);
      if (existingMember) {
        return res.status(400).json({ error: "Already a member of this channel" });
      }
      await db.insert(channelMembers).values({
        channelId,
        userId,
        role: "member"
      });
      broadcastEvent({
        type: "channel",
        data: {
          action: "member_joined",
          channelId,
          userId
        }
      });
      res.json({ message: "Joined channel successfully" });
    } catch (error) {
      console.error("Failed to join channel:", error);
      res.status(500).json({ error: "Failed to join channel" });
    }
  });
  app.post("/api/channels/:channelId/invitations", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const { inviteeId } = req.body;
      const inviterId = req.user.id;
      const [channel] = await db.select().from(channels).where(eq3(channels.id, channelId)).limit(1);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      const [inviterMembership] = await db.select().from(channelMembers).where(
        and2(
          eq3(channelMembers.channelId, channelId),
          eq3(channelMembers.userId, inviterId)
        )
      ).limit(1);
      if (!inviterMembership) {
        return res.status(403).json({ error: "Only channel members can send invitations" });
      }
      const [existingMember] = await db.select().from(channelMembers).where(
        and2(
          eq3(channelMembers.channelId, channelId),
          eq3(channelMembers.userId, inviteeId)
        )
      ).limit(1);
      if (existingMember) {
        return res.status(400).json({ error: "User is already a member of this channel" });
      }
      const [existingInvitation] = await db.select().from(channelInvitations).where(
        and2(
          eq3(channelInvitations.channelId, channelId),
          eq3(channelInvitations.inviteeId, inviteeId),
          eq3(channelInvitations.status, "pending")
        )
      ).limit(1);
      if (existingInvitation) {
        return res.status(400).json({ error: "Invitation already sent to this user" });
      }
      const [invitation] = await db.insert(channelInvitations).values({
        channelId,
        inviterId,
        inviteeId,
        status: "pending"
      }).returning();
      const [invitedChannel] = await db.select().from(channels).where(eq3(channels.id, channelId)).limit(1);
      const [inviter] = await db.select().from(users).where(eq3(users.id, inviterId)).limit(1);
      broadcastEvent({
        type: "channel",
        data: {
          action: "invitation_created",
          invitation: {
            ...invitation,
            channel: invitedChannel,
            inviter
          }
        }
      });
      res.json({ message: "Invitation sent successfully" });
    } catch (error) {
      console.error("Failed to send invitation:", error);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });
  app.post("/api/channels/:channelId/invitations/:invitationId", requireAuth, async (req, res) => {
    try {
      const { channelId, invitationId } = req.params;
      const { action } = req.body;
      const userId = req.user.id;
      if (!["accept", "reject"].includes(action)) {
        return res.status(400).json({ error: "Invalid action" });
      }
      const [invitation] = await db.select().from(channelInvitations).where(
        and2(
          eq3(channelInvitations.id, parseInt(invitationId)),
          eq3(channelInvitations.channelId, parseInt(channelId)),
          eq3(channelInvitations.inviteeId, userId),
          eq3(channelInvitations.status, "pending")
        )
      ).limit(1);
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or already processed" });
      }
      await db.update(channelInvitations).set({ status: action === "accept" ? "accepted" : "rejected" }).where(eq3(channelInvitations.id, parseInt(invitationId)));
      if (action === "accept") {
        await db.insert(channelMembers).values({
          channelId: parseInt(channelId),
          userId,
          role: "member"
        });
        broadcastEvent({
          type: "channel",
          data: {
            action: "member_joined",
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
  app.get("/api/channels/:channelId", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const [channel] = await db.select().from(channels).where(eq3(channels.id, channelId)).limit(1);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      const members = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: channelMembers.role
      }).from(channelMembers).leftJoin(users, eq3(channelMembers.userId, users.id)).where(eq3(channelMembers.channelId, channelId));
      res.json({
        ...channel,
        members
      });
    } catch (error) {
      console.error("Error fetching channel:", error);
      res.status(500).json({ error: "Failed to fetch channel details" });
    }
  });
  app.post("/api/channels/:channelId/leave", requireAuth, async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      const userId = req.user.id;
      const [channel] = await db.select().from(channels).where(eq3(channels.id, channelId)).limit(1);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      const [membership] = await db.select().from(channelMembers).where(
        and2(
          eq3(channelMembers.channelId, channelId),
          eq3(channelMembers.userId, userId)
        )
      ).limit(1);
      if (!membership) {
        return res.status(400).json({ error: "Not a member of this channel" });
      }
      if (membership.role === "owner") {
        return res.status(400).json({ error: "Channel owner cannot leave. Delete the channel instead." });
      }
      await db.delete(channelMembers).where(
        and2(
          eq3(channelMembers.channelId, channelId),
          eq3(channelMembers.userId, userId)
        )
      );
      broadcastEvent({
        type: "channel",
        data: {
          action: "member_left",
          channelId,
          userId
        }
      });
      res.json({ message: "Left channel successfully" });
    } catch (error) {
      console.error("Failed to leave channel:", error);
      res.status(500).json({ error: "Failed to leave channel" });
    }
  });
  app.delete("/api/messages/:messageId", requireAuth, async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = req.user.id;
      const [message] = await db.select().from(messages).where(
        and2(
          eq3(messages.id, messageId),
          eq3(messages.senderId, userId)
        )
      ).limit(1);
      if (!message) {
        return res.status(404).json({ error: "Message not found or you don't have permission to delete it" });
      }
      if (message.recipientId) {
        const [recipient] = await db.select().from(users).where(
          and2(
            eq3(users.id, message.recipientId),
            eq3(users.username, "ai-assistant")
          )
        ).limit(1);
        if (recipient) {
          const aiReplies = await db.select().from(messages).where(
            and2(
              eq3(messages.senderId, message.recipientId),
              eq3(messages.recipientId, userId),
              sql2`created_at >= ${message.createdAt}`
            )
          );
          if (aiReplies.length > 0) {
            await db.delete(reactions).where(inArray(reactions.messageId, aiReplies.map((m) => m.id)));
            await db.delete(messages).where(inArray(messages.id, aiReplies.map((m) => m.id)));
            aiReplies.forEach((aiReply) => {
              broadcastEvent({
                type: "message_deleted",
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
      await db.delete(reactions).where(eq3(reactions.messageId, messageId));
      await db.delete(messages).where(eq3(messages.id, messageId));
      broadcastEvent({
        type: "message_deleted",
        data: {
          messageId,
          channelId: message.channelId,
          recipientId: message.recipientId
        }
      });
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error("Failed to delete message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });
  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    try {
      const { content, channelId, parentId } = req.body;
      const [aiBot] = await db.select().from(users).where(eq3(users.username, "ai-assistant")).limit(1);
      if (!aiBot) {
        throw new Error("AI bot user not found");
      }
      const aiResponse = await generateAIResponse(content);
      const [message] = await db.insert(messages).values({
        content: aiResponse,
        senderId: aiBot.id,
        channelId: channelId ? parseInt(channelId) : null,
        recipientId: req.user.id,
        parentId: parentId ? parseInt(parentId) : null
      }).returning();
      const [formattedMessage] = await db.select({
        message: messages,
        sender: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl
        }
      }).from(messages).where(eq3(messages.id, message.id)).innerJoin(users, eq3(messages.senderId, users.id)).limit(1);
      broadcastEvent({
        type: "message",
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
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Failed to process AI chat message" });
    }
  });
  app.post("/api/documents/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      if (!req.file.mimetype.includes("pdf")) {
        return res.status(400).json({ error: "Only PDF files are supported" });
      }
      await processDocument(req.file.path);
      res.json({ message: "Document processed successfully" });
    } catch (error) {
      console.error("Failed to process document:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });
  app.post("/api/documents/process-all", async (req, res) => {
    try {
      const uploadsDir = path3.join(process.cwd(), "data", "uploads");
      const files = fs3.readdirSync(uploadsDir);
      for (const file of files) {
        if (file.toLowerCase().endsWith(".pdf")) {
          const filePath = path3.join(uploadsDir, file);
          await processDocument(filePath);
        }
      }
      res.json({ message: "All documents processed successfully" });
    } catch (error) {
      console.error("Error processing documents:", error);
      res.status(500).json({ error: "Failed to process documents" });
    }
  });
  app.post("/api/documents/process", requireAuth, async (req, res) => {
    try {
      console.log("Starting document processing...");
      await processAllDocuments();
      res.json({ message: "Documents processed successfully" });
    } catch (error) {
      console.error("Error processing documents:", error);
      res.status(500).json({ error: "Failed to process documents" });
    }
  });
  app.get("/api/debug/users", async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName
      }).from(users);
      res.json(allUsers);
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app.post("/api/users/me/avatar", requireAuth, avatarUpload.single("avatar"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const avatarUrl = `/api/avatars/${req.file.filename}`;
      await db.update(users).set({ avatarUrl }).where(eq3(users.id, req.user.id));
      broadcastEvent({
        type: "profile_update",
        data: {
          userId: req.user.id,
          avatarUrl
        }
      });
      res.json({ avatarUrl });
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });
  app.get("/api/avatars/:filename", (req, res) => {
    const fileName = path3.basename(req.params.filename);
    const filePath = path3.join(process.cwd(), "data", "avatars", fileName);
    if (!fs3.existsSync(filePath)) {
      return res.status(404).json({ error: "Avatar not found" });
    }
    const normalizedFilePath = path3.normalize(filePath);
    const normalizedAvatarsDir = path3.normalize(path3.join(process.cwd(), "data", "avatars"));
    if (!normalizedFilePath.startsWith(normalizedAvatarsDir)) {
      return res.status(403).json({ error: "Invalid avatar path" });
    }
    const ext = path3.extname(filePath).toLowerCase();
    switch (ext) {
      case ".jpg":
      case ".jpeg":
        res.type("image/jpeg");
        break;
      case ".png":
        res.type("image/png");
        break;
      case ".gif":
        res.type("image/gif");
        break;
      case ".webp":
        res.type("image/webp");
        break;
      default:
        res.type("application/octet-stream");
    }
    res.sendFile(filePath);
  });
  return httpServer;
}

// db/seed.ts
import { eq as eq4, and as and3, not } from "drizzle-orm";
import bcrypt from "bcryptjs";
async function seedDatabase() {
  try {
    console.log("Starting database seeding...");
    console.log("Creating AI assistant (Sarah)...");
    const hashedBotPassword = await bcrypt.hash("ai-bot-password-" + Date.now(), 10);
    const [sarah] = await db.insert(users).values({
      username: "ai-assistant",
      password: hashedBotPassword,
      displayName: "Sarah Thompson",
      aboutMe: "Financial analyst specializing in Berkshire Hathaway. I help investors understand Warren Buffett's investment philosophy through analysis of Berkshire's annual letters.",
      avatarUrl: "https://i.ibb.co/RcQNpWT/cadf33f5-6940-4a7f-8238-2f4e2949d4a0.webp"
    }).onConflictDoUpdate({
      target: users.username,
      set: {
        displayName: "Sarah Thompson",
        aboutMe: "Financial analyst specializing in Berkshire Hathaway. I help investors understand Warren Buffett's investment philosophy through analysis of Berkshire's annual letters.",
        avatarUrl: "https://i.ibb.co/RcQNpWT/cadf33f5-6940-4a7f-8238-2f4e2949d4a0.webp"
      }
    }).returning();
    console.log("Sarah created/updated with ID:", sarah.id);
    console.log("Finding users to send initial messages to...");
    const usersToMessage = await db.select().from(users).where(not(eq4(users.username, "ai-assistant"))).all();
    console.log("Found users to message:", usersToMessage.map((u) => `${u.username} (ID: ${u.id})`));
    for (const user of usersToMessage) {
      console.log(`Checking for existing message to user ${user.username} (ID: ${user.id})...`);
      const existingMessage = await db.select().from(messages).where(
        and3(
          eq4(messages.senderId, sarah.id),
          eq4(messages.recipientId, user.id)
        )
      ).limit(1).all();
      if (!existingMessage.length) {
        console.log(`No existing message found, sending initial message to ${user.username}...`);
        try {
          const [message] = await db.insert(messages).values({
            content: "Hi! I'm Sarah Thompson, a financial analyst specializing in Berkshire Hathaway. I've spent years studying Warren Buffett's investment philosophy through the annual letters. I'd be happy to help you understand Berkshire's business and investment strategies - just ask me anything!",
            senderId: sarah.id,
            recipientId: user.id
          }).returning();
          console.log(`Successfully sent initial message (ID: ${message.id}) to user ${user.username}`);
        } catch (error) {
          console.error(`Error sending message to user ${user.username}:`, error);
        }
      } else {
        console.log(`Message already exists for user ${user.username}`);
      }
    }
    const publicChannels = await db.select().from(channels).where(eq4(channels.isPrivate, false)).all();
    for (const channel of publicChannels) {
      await db.insert(channelMembers).values({
        channelId: channel.id,
        userId: sarah.id,
        role: "member"
      }).onConflictDoNothing();
      console.log(`Added Sarah to channel: ${channel.name}`);
    }
    console.log("Database seeding completed successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// server/index.ts
import path4 from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path4.dirname(__filename);
async function startServer() {
  const app = express();
  app.use(express.json());
  await initializeDatabase();
  await seedDatabase();
  if (process.env.NODE_ENV === "production") {
    const clientDistPath = path4.join(__dirname, "../dist/public");
    app.use(express.static(clientDistPath));
  }
  const server = registerRoutes(app);
  if (process.env.NODE_ENV === "production") {
    const clientDistPath = path4.join(__dirname, "../dist/public");
    app.get("*", (req, res) => {
      if (req.url.startsWith("/api/")) {
        return res.status(404).send("Not found");
      }
      res.sendFile(path4.join(clientDistPath, "index.html"));
    });
  }
  const port = process.env.PORT || 3e3;
  server.listen(port, () => {
    console.log(`Server running on port ${port} in ${process.env.NODE_ENV || "development"} mode`);
  });
}
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
