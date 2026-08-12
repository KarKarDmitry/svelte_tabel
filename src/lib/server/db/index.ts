import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// idle_timeout закрывает неактивные соединения (иначе после рестарта БД пул
// продолжает использовать оборванные сокеты и сыпет ECONNRESET)
const client = postgres(env.DATABASE_URL, {
	max: 10,
	idle_timeout: 20,
	connect_timeout: 30
});

export const db = drizzle(client, { schema });
