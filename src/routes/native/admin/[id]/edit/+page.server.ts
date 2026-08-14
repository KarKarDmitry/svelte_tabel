import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { userService } from '$lib/server/db/user.service';
import { APIError } from 'better-auth/api';
import { denyIfNotAdmin, isAdmin } from '$lib/server/permissions';
import { toEmail } from '$lib/server/auth-utils';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) throw redirect(302, '/native/apps/tabel/tabel');

	const user = await userService.getById(event.params.id);
	if (!user) throw redirect(302, '/native/admin');

	return { user };
};

export const actions: Actions = {
	saveEdit: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;

		const formData = await event.request.formData();
		const userId = event.params.id;
		const login = formData.get('login')?.toString().trim() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';

		if (!login) {
			return fail(400, { message: 'Укажите логин' });
		}

		try {
			if (newPassword) {
				await auth.api.setUserPassword({
					body: { userId, newPassword },
					headers: event.request.headers
				});
			}
			// Логин (name + email) обновляем напрямую в БД: better-auth не позволяет
			// менять email через updateUser, а русский логин требует punycode-email
			await userService.updateLogin(userId, { name: login, email: toEmail(login) });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Ошибка обновления' });
			}
			return fail(500, { message: 'Неожиданная ошибка' });
		}

		return { success: true, message: 'Пользователь обновлён' };
	}
};
