var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// index.ts
import "dotenv/config";
import express from "express";

// routes.ts
import { createServer } from "http";

// auth.ts
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

// ../db/schema.ts
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
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  isOnline: integer("is_online", { mode: "boolean" }).default(false),
  status: text("status").default("offline"),
  isTyping: integer("is_typing", { mode: "boolean" }).default(false),
  lastSeen: text("last_seen").default(sql`CURRENT_TIMESTAMP`),
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

// ../db/index.ts
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { drizzle } from "drizzle-orm/better-sqlite3";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var dataDir = path.join(__dirname, "..", ".data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
var dbPath = path.join(dataDir, "chat.db");
console.log("Using database at:", dbPath);
var sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");
var db = drizzle(sqlite, { schema: schema_exports });
async function initializeDatabase() {
  try {
    console.log("Initializing database...");
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        is_online INTEGER DEFAULT 0 CHECK (is_online IN (0, 1)),
        status TEXT DEFAULT 'offline',
        is_typing INTEGER DEFAULT 0 CHECK (is_typing IN (0, 1)),
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channel_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channel_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel_id INTEGER REFERENCES channels(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES messages(id),
        reply_count INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_edited INTEGER DEFAULT 0 CHECK (is_edited IN (0, 1)),
        delivery_status TEXT NOT NULL DEFAULT 'sent',
        file_name TEXT,
        file_url TEXT,
        file_size INTEGER,
        file_type TEXT
      );

      CREATE TABLE IF NOT EXISTS reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
      CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);
      CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
    `);
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}
initializeDatabase().then(() => console.log("Database initialization completed")).catch((err) => console.error("Failed to initialize database:", err));

// auth.ts
import { eq } from "drizzle-orm";
import cookieParser from "cookie-parser";
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
  secret: process.env.SESSION_SECRET || "chat-genius-session-secret",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  store,
  name: "connect.sid",
  cookie: {
    secure: false,
    // Allow non-HTTPS for now since we're running locally
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1e3,
    // 24 hours
    path: "/"
  }
});
function setupAuth(app) {
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  app.use((req, res, next) => {
    const origin = req.headers.origin || "http://localhost:3000";
    const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.secure || isLocalhost) {
      req.session.cookie.secure = false;
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.use(cookieParser());
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => {
    console.log("Session debug:");
    console.log("- Session ID:", req.sessionID);
    console.log("- Is Authenticated:", req.isAuthenticated());
    console.log("- Session:", req.session);
    console.log("- Cookies:", req.cookies);
    console.log("- Headers:", req.headers);
    console.log("- Origin:", req.headers.origin || req.get("origin") || req.headers.referer);
    next();
  });
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(users.username, username)
        });
        if (!user) {
          return done(null, false, { message: "User not found." });
        }
        const isMatch = await crypto.compare(password, user.passwordHash);
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
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, username)
      });
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const hashedPassword = await crypto.hash(password);
      const [user] = await db.insert(users).values({
        username,
        passwordHash: hashedPassword
      }).returning();
      req.login(user, (err) => {
        if (err) {
          console.error("Error logging in after registration:", err);
          return res.status(500).json({ error: "Error logging in after registration" });
        }
        return res.json({ user });
      });
    } catch (err) {
      console.error("Error creating user:", err);
      return res.status(500).json({ error: "Error creating user" });
    }
  });
  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    console.log("Login successful for user:", req.user?.username);
    console.log("Session after login:", req.session);
    res.json({ user: req.user });
  });
  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });
  app.get("/api/user", (req, res) => {
    console.log("Checking auth status. Is authenticated:", req.isAuthenticated());
    console.log("Current user:", req.user);
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ user: req.user });
  });
}

// routes.ts
import fs2 from "fs";
import multer from "multer";
import path2 from "path";
import { WebSocketServer } from "ws";

// websocket.ts
function setupWebSocket(wss) {
  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      console.log("Received:", message);
    });
    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });
}

// routes.ts
var upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path2.join(process.cwd(), "data", "uploads");
      fs2.mkdirSync(uploadsDir, { recursive: true, mode: 493 });
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path2.extname(file.originalname).toLowerCase();
      const timestamp = Date.now();
      cb(null, `${timestamp}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
  // 10MB limit
});
var avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const avatarsDir = path2.join(process.cwd(), "data", "avatars");
    fs2.mkdirSync(avatarsDir, { recursive: true, mode: 493 });
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path2.extname(file.originalname).toLowerCase();
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
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  setupWebSocket(wss);
  return server;
}

// ../db/seed.ts
import { eq as eq2, and, not } from "drizzle-orm";
import bcrypt from "bcryptjs";
async function seedDatabase() {
  try {
    console.log("Starting database seeding...");
    console.log("Creating AI assistant (Sarah)...");
    const hashedBotPassword = await bcrypt.hash("ai-bot-password-" + Date.now(), 10);
    const [sarah] = await db.insert(users).values({
      username: "ai-assistant",
      passwordHash: hashedBotPassword,
      displayName: "Sarah Thompson",
      email: "sarah@example.com",
      avatarUrl: "https://example.com/sarah-avatar.jpg",
      status: "online"
    }).onConflictDoUpdate({
      target: users.username,
      set: {
        displayName: "Sarah Thompson",
        email: "sarah@example.com",
        avatarUrl: "https://example.com/sarah-avatar.jpg",
        status: "online"
      }
    }).returning();
    console.log("Sarah created/updated with ID:", sarah.id);
    console.log("Finding users to send initial messages to...");
    const usersToMessage = await db.select().from(users).where(not(eq2(users.username, "ai-assistant"))).all();
    console.log("Found users to message:", usersToMessage.map((u) => `${u.username} (ID: ${u.id})`));
    for (const user of usersToMessage) {
      console.log(`Checking for existing message to user ${user.username} (ID: ${user.id})...`);
      const existingMessage = await db.select().from(messages).where(
        and(
          eq2(messages.senderId, sarah.id),
          eq2(messages.recipientId, user.id)
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
    const publicChannels = await db.select().from(channels).where(eq2(channels.isPrivate, false)).all();
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

// index.ts
import path3 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import session2 from "express-session";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path3.dirname(__filename2);
var DIST_DIR = path3.join(__dirname2, "../../dist");
async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(session2({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      // Only use secure in production
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1e3
      // 24 hours
    }
  }));
  await initializeDatabase();
  await seedDatabase();
  console.log("Serving static files from:", DIST_DIR);
  app.use(express.static(DIST_DIR));
  registerRoutes(app);
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path3.join(DIST_DIR, "index.html"));
    }
  });
  const port = process.env.PORT || 3e3;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log("Environment:", process.env.NODE_ENV);
    console.log("Platform:", process.env.AWS_LAMBDA_FUNCTION_VERSION ? "AWS" : "Other");
    console.log("Static files being served from:", DIST_DIR);
  });
}
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
