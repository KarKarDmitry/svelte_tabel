import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { toEmail, type AppRole } from '$lib/server/auth-utils';

const isRole = (r: unknown): r is AppRole => r === 'admin' || r === 'user';

export const load: PageServerLoad = async () => {
	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
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

		try {
			await auth.api.signUpEmail({
				body: {
					email: toEmail(username),
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

	toggleRole: async (event) => {
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();
		const role = formData.get('role')?.toString();

		if (!userId || !isRole(role)) {
			return fail(400, { message: 'Некорректные параметры' });
		}

		const target = await db
			.select()
			.from(user)
			.where(eq(user.id, userId))
			.then((r) => r[0]);
		if (!target) {
			return fail(404, { message: 'Пользователь не найден' });
		}

		const isSelf = event.locals.user?.id === userId;

		// Нельзя снять админа с самого себя
		if (isSelf && target.role === 'admin' && role === 'user') {
			return fail(400, { message: 'Нельзя снять роль администратора с самого себя' });
		}

		// Нельзя снять админа с последнего оставшегося администратора
		if (target.role === 'admin' && role === 'user') {
			const adminCount = await db
				.select({ count: user.id })
				.from(user)
				.where(eq(user.role, 'admin'))
				.then((r) => r.length);
			if (adminCount <= 1) {
				return fail(400, { message: 'Нельзя снять роль с последнего администратора' });
			}
		}

		await db.update(user).set({ role }).where(eq(user.id, userId));
		return { success: true };
	},

	deleteUser: async (event) => {
		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();

		if (!userId) {
			return fail(400, { message: 'ID пользователя не указан' });
		}

		const target = await db
			.select()
			.from(user)
			.where(eq(user.id, userId))
			.then((r) => r[0]);
		if (!target) {
			return fail(404, { message: 'Пользователь не найден' });
		}

		// Нельзя удалить самого себя
		if (event.locals.user?.id === userId) {
			return fail(400, { message: 'Нельзя удалить самого себя' });
		}

		// Нельзя удалить последнего администратора
		if (target.role === 'admin') {
			const adminCount = await db
				.select({ count: user.id })
				.from(user)
				.where(eq(user.role, 'admin'))
				.then((r) => r.length);
			if (adminCount <= 1) {
				return fail(400, { message: 'Нельзя удалить последнего администратора' });
			}
		}

		await db.delete(user).where(eq(user.id, userId));
		return { success: true };
	}
};
