import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { userService } from '$lib/server/db/user.service';
import { masterService } from '$lib/server/db/apps/tabel/services/master.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { APIError } from 'better-auth/api';
import { denyIfNotAdmin } from '$lib/server/permissions';
import { toEmail, type AppRole } from '$lib/server/auth-utils';

const isRole = (r: unknown): r is AppRole => r === 'admin' || r === 'timekeeper' || r === 'user';

export const load: PageServerLoad = async () => {
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

	// Смена логина и/или сброс пароля пользователя (только для админов)
	updateUser: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;

		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString() ?? '';
		const login = formData.get('login')?.toString().trim() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';

		if (!userId || !login) {
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

		return { success: true };
	},

	setAccess: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;

		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString();
		const role = formData.get('role')?.toString();
		const rawDepts = formData.get('departmentIds')?.toString() ?? '';

		if (!userId || !isRole(role)) {
			return fail(400, { message: 'Некорректные параметры' });
		}

		let departmentIds: number[] = [];
		try {
			const parsed = rawDepts ? JSON.parse(rawDepts) : [];
			if (!Array.isArray(parsed) || parsed.some((d) => !Number.isInteger(d) || d <= 0)) {
				return fail(400, { message: 'Некорректный список подразделений' });
			}
			departmentIds = parsed;
		} catch {
			return fail(400, { message: 'Некорректный список подразделений' });
		}

		const target = await userService.getById(userId);
		if (!target) {
			return fail(404, { message: 'Пользователь не найден' });
		}

		const isSelf = event.locals.user?.id === userId;

		// Нельзя снять админа с самого себя
		if (isSelf && target.role === 'admin' && role !== 'admin') {
			return fail(400, { message: 'Нельзя снять роль администратора с самого себя' });
		}

		// Нельзя снять админа с последнего оставшегося администратора
		if (target.role === 'admin' && role !== 'admin') {
			const adminCount = await userService.countAdmins();
			if (adminCount <= 1) {
				return fail(400, { message: 'Нельзя снять роль с последнего администратора' });
			}
		}

		// Роль + синхронизация подразделений (bulk через сервисы)
		await userService.updateRole(userId, role);
		await masterService.syncActiveDepartments(
			userId,
			departmentIds,
			new Date().toISOString().split('T')[0]
		);

		return { success: true };
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
		return { success: true };
	}
};
