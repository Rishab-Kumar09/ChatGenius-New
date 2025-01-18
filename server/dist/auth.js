"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionMiddleware = void 0;
exports.setupAuth = setupAuth;
const passport_1 = __importDefault(require("passport"));
const passport_local_1 = require("passport-local");
const express_session_1 = __importDefault(require("express-session"));
const memorystore_1 = __importDefault(require("memorystore"));
const crypto_1 = require("crypto");
const util_1 = require("util");
const schema_1 = require("@db/schema");
const _db_1 = require("@db");
const drizzle_orm_1 = require("drizzle-orm");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
const crypto = {
    hash: async (password) => {
        const salt = (0, crypto_1.randomBytes)(16).toString("hex");
        const buf = (await scryptAsync(password, salt, 64));
        return `${buf.toString("hex")}.${salt}`;
    },
    compare: async (suppliedPassword, storedPassword) => {
        const [hashedPassword, salt] = storedPassword.split(".");
        const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
        const suppliedPasswordBuf = (await scryptAsync(suppliedPassword, salt, 64));
        return (0, crypto_1.timingSafeEqual)(hashedPasswordBuf, suppliedPasswordBuf);
    },
};
// Create session store
const MemoryStore = (0, memorystore_1.default)(express_session_1.default);
const store = new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
});
// Create session middleware
exports.sessionMiddleware = (0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || "chat-genius-session-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store,
    name: 'connect.sid',
    cookie: {
        secure: false, // Set to false for local development
        httpOnly: true,
        sameSite: 'lax', // Changed to lax for local development
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
    }
});
function setupAuth(app) {
    // Trust proxy in production
    if (app.get("env") === "production") {
        app.set('trust proxy', true);
    }
    // Add cookie parser before session middleware
    app.use((0, cookie_parser_1.default)());
    app.use(exports.sessionMiddleware);
    app.use(passport_1.default.initialize());
    app.use(passport_1.default.session());
    // Add session debug middleware
    app.use((req, res, next) => {
        console.log('Session debug:');
        console.log('- Session ID:', req.sessionID);
        console.log('- Is Authenticated:', req.isAuthenticated());
        console.log('- Session:', req.session);
        console.log('- Cookies:', req.cookies);
        console.log('- Headers:', req.headers);
        console.log('- Origin:', req.headers.origin || req.get('origin') || req.headers.referer);
        next();
    });
    passport_1.default.use(new passport_local_1.Strategy(async (username, password, done) => {
        try {
            const user = await _db_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.users.username, username),
            });
            if (!user) {
                return done(null, false, { message: "User not found." });
            }
            const isMatch = await crypto.compare(password, user.passwordHash);
            if (!isMatch) {
                return done(null, false, { message: "Incorrect password." });
            }
            return done(null, user);
        }
        catch (err) {
            return done(err);
        }
    }));
    passport_1.default.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport_1.default.deserializeUser(async (id, done) => {
        try {
            const [user] = await _db_1.db
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.eq)(schema_1.users.id, id))
                .limit(1);
            done(null, user);
        }
        catch (err) {
            done(err);
        }
    });
    app.post("/api/register", async (req, res) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }
        try {
            const existingUser = await _db_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.users.username, username),
            });
            if (existingUser) {
                return res.status(400).json({ error: "Username already exists" });
            }
            const hashedPassword = await crypto.hash(password);
            const [user] = await _db_1.db.insert(schema_1.users)
                .values({
                username,
                passwordHash: hashedPassword,
            })
                .returning();
            // Log the user in after registration
            req.login(user, (err) => {
                if (err) {
                    console.error("Error logging in after registration:", err);
                    return res.status(500).json({ error: "Error logging in after registration" });
                }
                return res.json({ user });
            });
        }
        catch (err) {
            console.error("Error creating user:", err);
            return res.status(500).json({ error: "Error creating user" });
        }
    });
    app.post("/api/login", passport_1.default.authenticate("local"), (req, res) => {
        console.log("Login successful for user:", req.user?.username);
        console.log("Session after login:", req.session);
        res.json({ user: req.user });
    });
    app.post("/api/logout", (req, res) => {
        req.logout(() => {
            res.json({ success: true });
        });
    });
    app.get("/api/user", (req, res) => {
        console.log("Checking auth status. Is authenticated:", req.isAuthenticated());
        console.log("Current user:", req.user);
        if (!req.user) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        res.json({ user: req.user });
    });
}
