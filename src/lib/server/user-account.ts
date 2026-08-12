import { fail } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { userService } from '$lib/server/db/user.service';
import { APIError } from 'better-auth/api';
import { toEmail } from '$lib/server/auth-utils';

type PermUser = { id: string } | null | undefined;

/** Смена логина (name + email) для самого пользователя */
export async function updateProfileAction(
	user: PermUser,
	formData: FormData
): Promise<{ success: true; message: string } | ReturnType<typeof fail>> {
	if (!user) return fail(401, { message: 'Не авторизован' });

	const login = formData.get('login')?.toString().trim() ?? '';
	if (!login) return fail(400, { message: 'Укажите логин' });

	try {
		await userService.updateLogin(user.id, { name: login, email: toEmail(login) });
	} catch (e) {
		return fail(400, {
			message: e instanceof Error ? e.message : 'Не удалось изменить логин'
		});
	}
	return { success: true, message: 'Логин обновлён' };
}

/** Смена пароля для самого пользователя */
export async function changePasswordAction(
	user: PermUser,
	formData: FormData,
	headers: Headers
): Promise<{ success: true; message: string } | ReturnType<typeof fail>> {
	if (!user) return fail(401, { message: 'Не авторизован' });

	const currentPassword = formData.get('currentPassword')?.toString() ?? '';
	const newPassword = formData.get('newPassword')?.toString() ?? '';
	const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

	if (newPassword !== confirmPassword) {
		return fail(400, { message: 'Пароли не совпадают' });
	}
	if (newPassword.length < 3) {
		return fail(400, { message: 'Пароль слишком короткий (минимум 3 символа)' });
	}

	try {
		await auth.api.changePassword({
			body: { currentPassword, newPassword },
			headers
		});
	} catch (e) {
		if (e instanceof APIError) {
			return fail(400, { message: e.message || 'Не удалось сменить пароль' });
		}
		return fail(500, { message: 'Неожиданная ошибка' });
	}
	return { success: true, message: 'Пароль изменён' };
}
