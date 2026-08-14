import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { userService } from '$lib/server/db/user.service';
import { masterService } from '$lib/server/db/apps/tabel/services/master.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { denyIfNotAdmin, isAdmin } from '$lib/server/permissions';
import type { AppRole } from '$lib/server/auth-utils';

const isRole = (r: unknown): r is AppRole => r === 'admin' || r === 'timekeeper' || r === 'user';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) throw redirect(302, '/native/apps/tabel/tabel');

	const userId = event.params.id;
	const [user, departments, groups, assignments] = await Promise.all([
		userService.getById(userId),
		departmentService.list(),
		departmentGroupService.listWithDepartments(),
		masterService.listWithDepartments()
	]);

	if (!user) throw redirect(302, '/native/admin');

	return { user, departments, assignments, departmentGroups: groups };
};

export const actions: Actions = {
	saveAccess: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;

		const formData = await event.request.formData();
		const userId = event.params.id;
		const role = formData.get('role')?.toString();
		const rawIds = formData.getAll('departmentIds').map((v) => Number(v));

		if (!isRole(role)) {
			return fail(400, { message: 'Некорректная роль' });
		}
		const departmentIds = rawIds.filter((d) => Number.isInteger(d) && d > 0);

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

		await userService.updateRole(userId, role);
		await masterService.syncActiveDepartments(
			userId,
			departmentIds,
			new Date().toISOString().split('T')[0]
		);

		return { success: true, message: 'Доступ обновлён' };
	}
};
