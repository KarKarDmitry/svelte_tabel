import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';

export const GET = async () => {
	const existing = await db.select().from(user).where(eq(user.email, 'admin@mettem.com')).limit(1);

	if (existing.length > 0) {
		// Удаляем старого админа с кривым хешем и создаём заново
		await db.delete(user).where(eq(user.id, existing[0].id));
	}

	await auth.api.signUpEmail({
		body: {
			email: 'admin@mettem.com',
			password: '***REMOVED***',
			name: 'admin'
		}
	});

	return new Response('Готово! Админ: admin / ***REMOVED***', { status: 200 });
};
