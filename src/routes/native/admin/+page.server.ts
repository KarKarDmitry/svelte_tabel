import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { userService } from '$lib/server/db/user.service';
import { masterService } from '$lib/server/db/apps/tabel/services/master.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { APIError } from 'better-auth/api';
import { denyIfNotAdmin, isAdmin } from '$lib/server/permissions';
import { toEmail, type AppRole } from '$lib/server/auth-utils';

const isRole = (r: unknown): r is AppRole => r === 'admin' || r === 'timekeeper' || r === 'user';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) throw redirect(302, '/native/apps/tabel/tabel');

	const [users, departments, groups, assignments] = await Promise.all([
		userService.list(),
		departmentService.list(),
		departmentGroupService.listWithDepartments(),
		masterService.listWithDepartments()
	]);

	return { users, departments, assignments, departmentGroups: groups };
};

export const actions: Actions = {
	createUser: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;

		const formData = await event.request.formData();
		const username = formData.get('username')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (password.length < 8) {
			return fail(400, { message: 'Пароль должен быть не короче 8 символов' });
		}

		try {
			await auth.api.createUser({
				body: {
					email: toEmail(username),
					password,
					name: username,
					role: 'user'
				},
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Ошибка создания' });
			}
			return fail(500, { message: 'Неожиданная ошибка' });
		}

		return { success: true, message: 'Пользователь создан' };
	},

	deleteUser: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;

		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();

		if (!userId) {
			return fail(400, { message: 'ID пользователя не указан' });
		}

		const target = await userService.getById(userId);
		if (!target) {
			return fail(404, { message: 'Пользователь не найден' });
		}

		// Нельзя удалить самого себя
		if (event.locals.user?.id === userId) {
			return fail(400, { message: 'Нельзя удалить самого себя' });
		}

		// Нельзя удалить последнего администратора
		if (target.role === 'admin') {
			const adminCount = await userService.countAdmins();
			if (adminCount <= 1) {
				return fail(400, { message: 'Нельзя удалить последнего администратора' });
			}
		}

		await userService.remove(userId);
		return { success: true, message: 'Пользователь удалён' };
	}
};
