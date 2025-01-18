import 'dotenv/config';
import express from "express";
import { registerRoutes } from "./routes";
import { initializeDatabase } from "@db";
import { seedDatabase } from "@db/seed";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';
import session from 'express-session';
// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function startServer() {
    const app = express();
    // Parse JSON bodies
    app.use(express.json());
    // Configure session middleware
    app.use(session({
        secret: process.env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production', // Only use secure in production
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }));
    // Initialize database and create tables
    await initializeDatabase();
    // Run database seeding
    await seedDatabase();
    // Determine client dist path based on environment
    const clientDistPath = path.join(__dirname, '../dist');
    console.log('Serving static files from:', clientDistPath);
    // Serve static files
    if (fs.existsSync(clientDistPath)) {
        app.use(express.static(clientDistPath));
        console.log('Static files directory found at:', clientDistPath);
    }
    else {
        console.error('Static files directory not found:', clientDistPath);
    }
    // Set up API routes
    registerRoutes(app);
    // Serve index.html for all other routes (client-side routing)
    app.get('*', (req, res) => {
        const indexPath = path.join(clientDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            console.error('index.html not found at:', indexPath);
            res.status(404).send('Not found');
        }
    });
    // Start server
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        console.log('Environment:', process.env.NODE_ENV);
        console.log('Platform:', process.env.AWS_LAMBDA_FUNCTION_VERSION ? 'AWS' : 'Other');
        console.log('Static files being served from:', clientDistPath);
    });
}
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
