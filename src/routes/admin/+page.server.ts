import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = async () => {
	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			createdAt: user.createdAt
		})
		.from(user)
		.orderBy(user.createdAt);

	return { users };
};

export const actions: Actions = {
	createUser: async (event) => {
		const formData = await event.request.formData();
		const username = formData.get('username')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const email = username.includes('@') ? username : `${username}@local`;

		try {
			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name: username
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Ошибка создания' });
			}
			return fail(500, { message: 'Неожиданная ошибка' });
		}

		return { success: true };
	},

	deleteUser: async (event) => {
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();

		if (!userId) {
			return fail(400, { message: 'ID пользователя не указан' });
		}

		await db.delete(user).where(eq(user.id, userId));
		return { success: true };
	}
};
