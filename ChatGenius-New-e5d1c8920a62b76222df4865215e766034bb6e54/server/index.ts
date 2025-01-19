import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "@db";
import { seedDatabase } from "@db/seed";
import path from "path";
import { fileURLToPath } from 'url';

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

  // Serve static files from the client build directory
  const clientDistPath = path.join(__dirname, '../dist/public');
  app.use(express.static(clientDistPath));

  // Register API routes and get HTTP server instance
  const server = registerRoutes(app);

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Don't handle API routes
    if (req.url.startsWith('/api/')) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  // Start server
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});