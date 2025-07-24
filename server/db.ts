import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pool with SSL settings for production
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Disable SSL verification for local PostgreSQL connections
  ssl: process.env.NODE_ENV === 'production' && process.env.DATABASE_URL?.includes('localhost') 
    ? false 
    : process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false
};

export const pool = new Pool(poolConfig);
export const db = drizzle({ client: pool, schema });