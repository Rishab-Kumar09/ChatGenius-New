import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import cookieParser from 'cookie-parser';
const scryptAsync = promisify(scrypt);
const crypto = {
    hash: async (password) => {
        const salt = randomBytes(16).toString("hex");
        const buf = (await scryptAsync(password, salt, 64));
        return `${buf.toString("hex")}.${salt}`;
    },
    compare: async (suppliedPassword, storedPassword) => {
        const [hashedPassword, salt] = storedPassword.split(".");
        const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
        const suppliedPasswordBuf = (await scryptAsync(suppliedPassword, salt, 64));
        return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
    },
};
// Create session store
const MemoryStore = createMemoryStore(session);
const store = new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
});
// Create session middleware
export const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || "chat-genius-session-secret",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store,
    name: 'connect.sid',
    cookie: {
        secure: false, // Allow non-HTTPS for now since we're running locally
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
    }
});
export function setupAuth(app) {
    // Trust proxy in production
    if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
    }
    // Add CORS configuration
    app.use((req, res, next) => {
        const origin = req.headers.origin || 'http://localhost:3000';
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        // Set cookie options based on environment
        if (req.secure || isLocalhost) {
            req.session.cookie.secure = false;
        }
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        next();
    });
    // Add cookie parser before session middleware
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.use(passport.initialize());
    app.use(passport.session());
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
    passport.use(new LocalStrategy(async (username, password, done) => {
        try {
            const user = await db.query.users.findFirst({
                where: eq(users.username, username),
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
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport.deserializeUser(async (id, done) => {
        try {
            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.id, id))
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
            const existingUser = await db.query.users.findFirst({
                where: eq(users.username, username),
            });
            if (existingUser) {
                return res.status(400).json({ error: "Username already exists" });
            }
            const hashedPassword = await crypto.hash(password);
            const [user] = await db.insert(users)
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
    app.post("/api/login", passport.authenticate("local"), (req, res) => {
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
