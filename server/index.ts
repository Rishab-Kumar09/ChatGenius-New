import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "@db";
import { seedDatabase } from "@db/seed";
import path from "path";
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { setupAuth } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '../dist');

const isDevelopment = process.env.NODE_ENV === 'development';

async function startServer() {
  const app = express();

  // Trust proxy in production
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Parse JSON bodies
  app.use(express.json());

  // Configure CORS after session middleware
  const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://chat-genius.amplifyapp.com']
      : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  };

  // Setup auth (includes session middleware)
  setupAuth(app);

  // Add CORS after session middleware
  app.use(cors(corsOptions));

  // Register routes (includes auth setup)
  registerRoutes(app);

  // Database initialization
  await initializeDatabase();
  await seedDatabase();

  // Static files
  app.use(express.static(DIST_DIR));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
  });

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port} (${process.env.NODE_ENV})`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});