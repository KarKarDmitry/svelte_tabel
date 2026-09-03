import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { toEmail } from '../auth-utils';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL is not set');
	process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const auth = betterAuth({
	baseURL: (process.env.ORIGIN || 'http://localhost:5173').split(',')[0].trim(),
	secret: process.env.BETTER_AUTH_SECRET || 'dev-secret-change-in-production',
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: { enabled: true, minPasswordLength: 3 }
});

async function bootstrap() {
	console.log('🚀 Bootstrap: создание первого администратора\n');

	const login = process.env.BOOTSTRAP_LOGIN || 'admin';
	const password = process.env.BOOTSTRAP_PASSWORD || 'admin';
	const email = toEmail(login);

	const existing = await db.select().from(schema.user).limit(1);
	if (existing.length > 0) {
		console.log('  Пользователи уже существуют. Bootstrap пропущен.');
		process.exit(0);
	}

	await auth.api.signUpEmail({
		body: { email, password, name: login }
	});

	// Назначаем роль администратора первому пользователю
	await db.update(schema.user).set({ role: 'admin' }).where(eq(schema.user.email, email));

	console.log(`  ✓ Администратор создан:`);
	console.log(`    Логин: ${login}`);
	console.log(`    Пароль: ${password}`);

	console.log('\n✅ Bootstrap completed!');
	process.exit(0);
}

bootstrap().catch((e: any) => {
	console.error('❌ Ошибка:', e.message || e);
	process.exit(1);
});
