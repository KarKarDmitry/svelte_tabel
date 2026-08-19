import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/permissions';

// Служебный эндпоинт: пересоздать администратора (например, после изменения
// схемы better-auth, когда старый хеш пароля стал некорректным).
// Доступен только администратору и только при включённом флаге ALLOW_SETUP=1.
export const GET = async (event) => {
	if (env.ALLOW_SETUP !== '1') {
		throw error(404, 'Not found');
	}
	if (!env.BOOTSTRAP_PASSWORD) {
		throw error(500, 'BOOTSTRAP_PASSWORD не задан в .env');
	}

	requireAdmin(event.locals.user);

	const existing = await db.select().from(user).where(eq(user.email, 'admin@mettem.com')).limit(1);

	if (existing.length > 0) {
		// Удаляем старого админа с кривым хешем и создаём заново
		await db.delete(user).where(eq(user.id, existing[0].id));
	}

	const password = env.BOOTSTRAP_PASSWORD;
	await auth.api.signUpEmail({
		body: {
			email: 'admin@mettem.com',
			password,
			name: 'admin'
		}
	});

	return new Response(`Готово! Админ: admin / ${password}`, { status: 200 });
};