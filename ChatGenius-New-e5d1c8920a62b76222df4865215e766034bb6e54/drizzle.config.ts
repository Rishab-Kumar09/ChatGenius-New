import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "better-sqlite3",
  dbCredentials: {
    url: "sqlite.db"
  },
  verbose: true,
  strict: true
});