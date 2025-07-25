import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Simple PostgreSQL connection without SSL for local database
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

export const db = drizzle(pool, { schema });