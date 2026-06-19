import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const accounts = await db.select().from(schema.account);
console.log('Accounts:', JSON.stringify(accounts, null, 2));

const users = await db
	.select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
	.from(schema.user);
console.log('Users:', JSON.stringify(users, null, 2));

process.exit(0);
