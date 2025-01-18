"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const http_1 = require("http");
const auth_1 = require("./auth");
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const ws_1 = require("ws");
const websocket_1 = require("./websocket");
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
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            const uploadsDir = path_1.default.join(process.cwd(), 'data', 'uploads');
            fs_1.default.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
            cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
            const ext = path_1.default.extname(file.originalname).toLowerCase();
            const timestamp = Date.now();
            cb(null, `${timestamp}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// Configure multer for avatars
const avatarStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const avatarsDir = path_1.default.join(process.cwd(), 'data', 'avatars');
        fs_1.default.mkdirSync(avatarsDir, { recursive: true, mode: 0o755 });
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const timestamp = Date.now();
        cb(null, `${timestamp}${ext}`);
    }
});
const avatarUpload = (0, multer_1.default)({
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
function registerRoutes(app) {
    // Set up authentication routes and middleware
    (0, auth_1.setupAuth)(app);
    // Set up WebSocket server
    const server = (0, http_1.createServer)(app);
    const wss = new ws_1.WebSocketServer({ server });
    (0, websocket_1.setupWebSocket)(wss);
    return server;
}
