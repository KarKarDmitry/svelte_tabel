import type { PageServerLoad, Actions } from './$types';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { denyIfCannotEditEmployee, denyIfNoEdit } from '$lib/server/permissions';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const [passHistory, allPasses, activeAssignments] = await Promise.all([
		passService.getHistoryByEmployee(id),
		passService.list(),
		passService.listActiveAssignments()
	]);

	// Пропуска, назначенные другим сотрудникам — недоступны для выбора
	const occupiedPassIds = new Set(
		activeAssignments.filter((a: any) => a.employeeId !== id).map((a: any) => a.passId)
	);

	return { passHistory, allPasses, occupiedPassIds: [...occupiedPassIds] };
};

export const actions: Actions = {
	assignPass: async (event) => {
		const employeeId = Number(event.params.id);
		const denied = await denyIfCannotEditEmployee(event.locals.user, employeeId);
		if (denied) return denied;
		const f = await event.request.formData();
		const passId = Number(f.get('passId'));
		const dateFrom = f.get('dateFrom')?.toString() || new Date().toISOString().split('T')[0];

		// Проверяем, не занят ли пропуск другим сотрудником
		const existing = await passService.getActiveAssignment(passId);
		if (existing && existing.employeeId !== employeeId) {
			return fail(409, { error: 'pass_occupied' });
		}

		// Закрываем текущий активный пропуск сотрудника (если есть)
		const today = new Date().toISOString().split('T')[0];
		await passService.closeCurrent(employeeId, today);
		await passService.assignToEmployee({ employeeId, passId, dateFrom });
		redirect(302, `/native/apps/tabel/employees/${employeeId}/pass`);
	},

	removePass: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		const rec = await passService.getEmployeePassById(id);
		const denied = rec
			? await denyIfCannotEditEmployee(event.locals.user, rec.employeeId)
			: denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const today = new Date().toISOString().split('T')[0];
		await passService.closeEmployeePass(id, today);
		redirect(302, `/native/apps/tabel/employees/${event.params.id}/pass`);
	}
};
