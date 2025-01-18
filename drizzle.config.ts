import type { Config } from 'drizzle-kit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  schema: './db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
} satisfies Config;