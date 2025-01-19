import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "@db";
import { seedDatabase } from "@db/seed";
import path from "path";
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Configure CORS
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  }));

  // Add security headers for all routes
  app.use((req, res, next) => {
    // Basic security headers
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    
    // Additional security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('X-XSS-Protection', '1; mode=block');
    
    // Cache control for static assets
    if (req.url.match(/\.(css|js|jpg|png|gif|ico)$/)) {
      res.header('Cache-Control', 'public, max-age=31536000'); // 1 year
    }
    
    next();
  });

  // Parse JSON bodies
  app.use(express.json());

  // Initialize database and create tables
  await initializeDatabase();

  // Run database seeding
  await seedDatabase();

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '../dist/public');
    app.use(express.static(clientDistPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (path.match(/\.(css|js|jpg|png|gif|ico)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
        }
      }
    }));
  }

  // Register API routes and get HTTP server instance
  const server = registerRoutes(app);

  // Handle client-side routing in production
  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.join(__dirname, '../dist/public');
    app.get('*', (req, res) => {
      if (req.url.startsWith('/api/')) {
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Start server
  const port = process.env.PORT || 3000;
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  
  server.listen({ port, host }, () => {
    console.log(`Server running on ${host}:${port} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});