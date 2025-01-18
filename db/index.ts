import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create data directory in project root if it doesn't exist
const dataDir = path.join(__dirname, '..', '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Set database path to .data/chat.db in project root
const dbPath = path.join(dataDir, 'chat.db');
console.log('Using database at:', dbPath);

// Initialize database connection
const sqlite = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');

// Create Drizzle instance with SQLite
export const db = drizzle(sqlite, { schema });

// Initialize database - create tables if they don't exist
export async function initializeDatabase() {
  try {
    console.log('Initializing database...');
    
    // Create tables using raw SQL for proper initialization
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        is_online BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'offline',
        is_typing BOOLEAN DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        is_direct BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        sender_id INTEGER REFERENCES users(id),
        channel_id INTEGER REFERENCES channels(id),
        recipient_id INTEGER REFERENCES users(id),
        parent_id INTEGER REFERENCES messages(id),
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        file_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Initialize database on module import
initializeDatabase()
  .then(() => console.log('Database initialization completed'))
  .catch(err => console.error('Failed to initialize database:', err));