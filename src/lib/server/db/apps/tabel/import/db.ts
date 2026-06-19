import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Run with: DATABASE_URL=postgres://... npm run db:import');

const client = postgres(url);

export const db = drizzle(client, { schema });
