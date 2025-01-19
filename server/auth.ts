import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, type SelectUser, messages } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import cookieParser from 'cookie-parser';

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

// extend express user object with our schema
declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

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
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.amplifyapp.com' : undefined
  }
});

export function setupAuth(app: Express) {
  // Trust proxy in production
  if (app.get("env") === "production") {
    app.set('trust proxy', 1);
  }

  // Add cookie parser before session middleware
  app.use(cookieParser());

  // Session and passport middleware
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

  // Authentication routes
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }

      // Check if username already exists
      const [existingUsername] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUsername) {
        return res.status(400).send("Username already taken. Please choose another one.");
      }

      // Create the new user
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: await crypto.hash(password),
          email: `${username}@example.com`,
          displayName: username,
        })
        .returning();

      // Log the user in after registration
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: newUser
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: Express.User | false, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).send(info.message);
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log('Checking auth status. Is authenticated:', req.isAuthenticated());
    console.log('Current user:', req.user);
    if (!req.user) {
      return res.status(401).json(null);
    }
    res.json(req.user);
  });
}