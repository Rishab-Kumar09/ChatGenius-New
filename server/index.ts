import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "@db";
import { seedDatabase } from "@db/seed";
import path from "path";
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { setupAuth, sessionConfig } from './auth';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '../dist');

async function startServer() {
  const app = express();

  // Trust proxy in production
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Parse JSON bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup auth (includes session middleware)
  setupAuth(app);

  // Database initialization
  await initializeDatabase();
  await seedDatabase();

  // Register API routes first
  registerRoutes(app);

  // Serve static files from the React app
  app.use(express.static(DIST_DIR, {
    index: false // Don't auto-serve index.html
  }));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      // If it's an API route that wasn't handled, return 404
      res.status(404).json({ error: 'API endpoint not found' });
    } else {
      // For all other routes, serve the SPA
      res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
        if (err) {
          console.error('Error sending index.html:', err);
          res.status(500).send('Error loading application');
        }
      });
    }
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    // Log detailed error in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Detailed error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
    }
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    });
  });

  // Update CORS configuration
  app.use(cors({
    origin: [
      'https://chimerical-cassata-a69d3d.netlify.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

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