import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "./schema";
import { seedDatabase } from "./seed";

// Create SQLite database connection
const sqlite = new Database('chat.db');

// Create Drizzle instance
const db = drizzle(sqlite, { schema });

// Run migrations
async function runMigrations() {
  try {
    console.log('Creating SQLite tables...');

    // Create tables using raw SQL for better control
    sqlite.exec(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        display_name TEXT,
        email TEXT,
        avatar_url TEXT,
        about_me TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Channels table
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_private INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        sender_id INTEGER NOT NULL,
        channel_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        is_edited INTEGER NOT NULL DEFAULT 0,
        delivery_status TEXT NOT NULL DEFAULT 'sent',
        FOREIGN KEY (sender_id) REFERENCES users (id),
        FOREIGN KEY (channel_id) REFERENCES channels (id)
      );

      -- Channel members table
      CREATE TABLE IF NOT EXISTS channel_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (channel_id) REFERENCES channels (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    console.log('Successfully created all tables!');

    // Run the seed function to populate default data
    await seedDatabase();

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migrations
runMigrations().catch(console.error);