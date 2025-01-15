import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "@db";
import { seedDatabase } from "@db/seed";
import path from "path";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure upload directories
const uploadDir = path.join(process.env.HOME || process.cwd(), '.data', 'uploads');
const avatarDir = path.join(uploadDir, 'avatars');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Store avatars in a separate directory
    const dest = file.fieldname === 'avatar' ? avatarDir : uploadDir;
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Create multer instance
export const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

async function startServer() {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // Create upload directories if they don't exist
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(avatarDir, { recursive: true });

  // Serve static files from uploads directory
  app.use('/uploads', express.static(uploadDir));
  app.use('/uploads/avatars', express.static(avatarDir));

  // Initialize database and create tables
  await initializeDatabase();

  // Run database seeding
  await seedDatabase();

  // Register API routes and get HTTP server instance
  const server = registerRoutes(app);

  // Serve static files from the client build directory
  const clientDistPath = path.join(__dirname, '../dist/public');
  app.use(express.static(clientDistPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Don't handle API routes
    if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
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