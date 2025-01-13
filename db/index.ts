import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@db/schema";
import fs from 'fs';
import path from 'path';

// Create SQLite database connection with better error handling
function createDatabaseConnection() {
  try {
    const dbPath = process.env.REPL_DB_PATH || path.join(process.env.HOME || process.cwd(), '.data', 'chat.db');
    console.log('Database path:', dbPath);

    // Create database directory if it doesn't exist
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Check if database exists, if not create it
    const dbExists = fs.existsSync(dbPath);
    
    const sqlite = new Database(dbPath, {
      verbose: console.log // Log all queries
    });

    // Enable foreign keys and WAL mode for better performance and reliability
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('journal_mode = WAL');
    
    console.log(`SQLite database ${dbExists ? 'opened' : 'created'} at: ${dbPath}`);
    return sqlite;
  } catch (error) {
    console.error('Failed to create SQLite database connection:', error);
    throw error;
  }
}

// Initialize database connection
const sqlite = createDatabaseConnection();

// Create Drizzle instance with SQLite
export const db = drizzle(sqlite, { schema });

// Initialize database - create tables directly without migrations
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Create tables using raw SQL for proper initialization
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

      -- Drop and recreate messages table to ensure correct schema
      DROP TABLE IF EXISTS messages;
      CREATE TABLE messages (
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

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Initialize database on module import
initializeDatabase()
  .then(() => console.log('Database initialization completed'))
  .catch(err => console.error('Failed to initialize database:', err));