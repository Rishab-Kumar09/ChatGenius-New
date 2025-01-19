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
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Add security headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    app.use(express.static(clientDistPath));
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