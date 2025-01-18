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
    secure: false, // Set to false for local development
    httpOnly: true,
    sameSite: 'lax', // Changed to lax for local development
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  }
});

export function setupAuth(app: Express) {
  // Enable CORS with credentials before any route handlers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://deployment.d6mohvmmiv3bp.amplifyapp.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Trust proxy in production
  if (app.get("env") === "production") {
    app.set('trust proxy', true);
  }

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

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

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

      // Get Sarah's user ID
      const [sarah] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'ai-assistant'))
        .limit(1);

      if (sarah) {
        console.log('Sending initial message from Sarah to new user:', newUser.username);
        // Send initial message from Sarah
        await db
          .insert(messages)
          .values({
            content: "Hi! I'm Sarah Thompson, a financial analyst specializing in Berkshire Hathaway. I've spent years studying Warren Buffett's investment philosophy through the annual letters. I'd be happy to help you understand Berkshire's business and investment strategies - just ask me anything!",
            senderId: sarah.id,
            recipientId: newUser.id
          })
          .returning();
        console.log('Initial message sent successfully');
      }

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
    const { username, password } = req.body;
    console.log('Login attempt for username:', username);
      
    if (!username || !password) {
      return res.status(400).send("Username and password are required");
    }

    const cb = (err: any, user: Express.User, info: IVerifyOptions) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }

      if (!user) {
        console.log('Login failed:', info.message);
        return res.status(400).send(info.message ?? "Login failed");
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return next(err);
        }

        console.log('Login successful for user:', user.username);
        return res.json({
          message: "Login successful",
          user
        });
      });
    };
    passport.authenticate("local", cb)(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }

      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log('Checking auth status. Is authenticated:', req.isAuthenticated());
    console.log('Current user:', req.user);
    
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }

    res.status(401).send("Not logged in");
  });
}