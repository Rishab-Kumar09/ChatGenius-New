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
    } else {
      clientDistPath = path.join(__dirname, '../dist/public');
    }
  } else {
    clientDistPath = path.join(__dirname, '../dist/public');
  }

  console.log('Serving static files from:', clientDistPath);

  // Check if the directory exists
  if (!fs.existsSync(clientDistPath)) {
    console.error('Static files directory not found:', clientDistPath);
    // Try alternative paths
    const altPaths = [
      path.join(__dirname, './public'),
      path.join(process.cwd(), 'dist/public'),
      path.join(process.cwd(), 'public'),
      // AWS Amplify possible paths
      '/opt/nodejs/dist/public',
      '/var/task/dist/public',
      path.join(process.env.LAMBDA_TASK_ROOT || '', 'dist/public'),
    ];

    for (const altPath of altPaths) {
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
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
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
    console.log('Platform:', process.env.AWS_LAMBDA_FUNCTION_VERSION ? 'AWS' : process.env.RENDER ? 'Render' : 'Other');
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});