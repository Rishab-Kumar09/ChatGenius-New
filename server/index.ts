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

async function startServer() {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Add headers to allow CORS
  app.use((req, res, next) => {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    next();
  });

  // Initialize database and create tables
  await initializeDatabase();

  // Run database seeding
  await seedDatabase();

  // Determine client dist path based on environment
  let clientDistPath;
  if (process.env.NODE_ENV === 'production') {
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
      clientDistPath = '/opt/nodejs/dist/public';
    } else if (process.env.RENDER) {
      clientDistPath = path.join(process.env.RENDER_PROJECT_DIR || '', 'dist/public');
    } else if (process.env.REPL_ID) {
      clientDistPath = path.join(process.env.REPL_HOME || '', 'dist/public');
    } else {
      clientDistPath = path.join(__dirname, '../dist/public');
    }
  } else {
    clientDistPath = path.join(__dirname, '../dist/public');
  }

  console.log('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    AWS_LAMBDA_FUNCTION_VERSION: process.env.AWS_LAMBDA_FUNCTION_VERSION,
    RENDER: process.env.RENDER,
    RENDER_PROJECT_DIR: process.env.RENDER_PROJECT_DIR,
    REPL_ID: process.env.REPL_ID,
    REPL_HOME: process.env.REPL_HOME
  });
  
  console.log('Initial static files path:', clientDistPath);

  // Check if the directory exists
  if (!fs.existsSync(clientDistPath)) {
    console.error('Static files directory not found:', clientDistPath);
    // Try alternative paths
    const altPaths = [
      path.join(__dirname, './public'),
      path.join(process.cwd(), 'dist/public'),
      path.join(process.cwd(), 'public'),
      // AWS Amplify paths
      '/opt/nodejs/dist/public',
      '/var/task/dist/public',
      path.join(process.env.LAMBDA_TASK_ROOT || '', 'dist/public'),
      // Render paths
      path.join(process.env.RENDER_PROJECT_DIR || '', 'dist/public'),
      path.join(process.env.RENDER_PROJECT_DIR || '', 'public'),
      // Replit paths
      path.join(process.env.REPL_HOME || '', 'dist/public'),
      path.join(process.env.REPL_HOME || '', 'public'),
      // Additional common paths
      path.resolve(__dirname, '../client/dist'),
      path.resolve(__dirname, '../public'),
      path.resolve(process.cwd(), 'client/dist'),
    ];

    for (const altPath of altPaths) {
      console.log('Checking path:', altPath);
      if (fs.existsSync(altPath)) {
        console.log('Found alternative static files directory:', altPath);
        clientDistPath = altPath;
        break;
      }
    }
  }

  // Serve static files with proper MIME types
  app.use(express.static(clientDistPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Set proper MIME types
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
      
      // Set caching headers
      if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  }));

  // Register API routes and get HTTP server instance
  const server = registerRoutes(app);

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Don't handle API routes
    if (req.url.startsWith('/api/')) {
      return res.status(404).send('Not found');
    }
    
    const indexPath = path.join(clientDistPath, 'index.html');
    console.log('Attempting to serve index.html from:', indexPath);
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath, { root: '/' });
    } else {
      console.error('index.html not found at:', indexPath);
      res.status(404).send('Application files not found');
    }
  });

  // Start server
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Platform:', 
      process.env.AWS_LAMBDA_FUNCTION_VERSION ? 'AWS' : 
      process.env.RENDER ? 'Render' : 
      process.env.REPL_ID ? 'Replit' : 
      'Other'
    );
    console.log('Static files being served from:', clientDistPath);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});