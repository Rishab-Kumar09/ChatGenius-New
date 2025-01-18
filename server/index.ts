import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "@db";
import { seedDatabase } from "@db/seed";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '../../dist');

async function startServer() {
  const app = express();

  // Configure CORS for AWS
  app.use((req, res, next) => {
    // Get origin from request headers
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://chat-genius-new.onrender.com',
      'https://main.d2qm6cqq0orw0h.amplifyapp.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ];

    // Check if origin is allowed
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    // Required headers for credentials and methods
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  });

  // Parse JSON bodies
  app.use(express.json());

  // Initialize database and create tables
  await initializeDatabase();

  // Run database seeding
  await seedDatabase();

  // Serve static files
  console.log('Serving static files from:', DIST_DIR);
  app.use(express.static(DIST_DIR));

  // Set up API routes
  registerRoutes(app);

  // Serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
  });

  // Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Platform:', process.env.AWS_LAMBDA_FUNCTION_VERSION ? 'AWS' : 'Other');
    console.log('Static files being served from:', DIST_DIR);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});