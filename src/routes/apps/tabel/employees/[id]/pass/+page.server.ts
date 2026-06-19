import type { PageServerLoad, Actions } from './$types';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const passHistory = await passService.getHistoryByEmployee(id);
	const allPasses = await passService.list();

	// Собираем ID пропусков, которые уже назначены другим сотрудникам
	const activeAssignments = await passService.listActiveAssignments();
	const occupiedPassIds = new Set(
		activeAssignments.filter((a: any) => a.employeeId !== id).map((a: any) => a.passId)
	);

	return { passHistory, allPasses, occupiedPassIds: [...occupiedPassIds] };
};

export const actions: Actions = {
	assignPass: async (event) => {
		const employeeId = Number(event.params.id);
		const f = await event.request.formData();
		const passId = Number(f.get('passId'));
		const dateFrom = f.get('dateFrom')?.toString() || new Date().toISOString().split('T')[0];

		// Проверяем, не занят ли пропуск другим сотрудником
		const existing = await passService.getActiveAssignment(passId);

		if (existing && existing.employeeId !== employeeId) {
			return { success: false, error: 'Пропуск уже назначен другому сотруднику' };
		}

		// Закрываем текущий активный пропуск сотрудника (если есть)
		const today = new Date().toISOString().split('T')[0];
		await passService.closeCurrent(employeeId, today);

		await passService.assignToEmployee({ employeeId, passId, dateFrom });
		return { success: true };
	},
	removePass: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		const today = new Date().toISOString().split('T')[0];
		await passService.closeEmployeePass(id, today);
		return { success: true };
	}
};
