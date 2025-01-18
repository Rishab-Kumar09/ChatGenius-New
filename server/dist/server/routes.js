import { createServer } from "http";
import { setupAuth } from "./auth";
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { WebSocketServer } from 'ws';
import { setupWebSocket } from './websocket';
// Keep track of connected SSE clients and their last query times
const clients = new Set();
const userQueryTimes = new Map();
// Rate limit for user queries (5 seconds)
const USER_QUERY_RATE_LIMIT = 5000;
// Keep track of WebSocket server state
let isWsServerReady = false;
// Auth middleware
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    next();
};
// Configure multer for file uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
            fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
            cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const timestamp = Date.now();
            cb(null, `${timestamp}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// Configure multer for avatars
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const avatarsDir = path.join(process.cwd(), 'data', 'avatars');
        fs.mkdirSync(avatarsDir, { recursive: true, mode: 0o755 });
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const timestamp = Date.now();
        cb(null, `${timestamp}${ext}`);
    }
});
const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});
export function registerRoutes(app) {
    // Set up authentication routes and middleware
    setupAuth(app);
    // Set up WebSocket server
    const server = createServer(app);
    const wss = new WebSocketServer({ server });
    setupWebSocket(wss);
    return server;
}
