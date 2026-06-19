import type { PageServerLoad, Actions } from './$types';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const scheduleHistory = await scheduleService.getHistoryByEmployee(id);
	const allSchedules = await scheduleService.list();
	return { scheduleHistory, allSchedules };
};

export const actions: Actions = {
	assignSchedule: async (event) => {
		const employeeId = Number(event.params.id);
		const f = await event.request.formData();
		const scheduleId = Number(f.get('scheduleId'));
		const dateFrom = f.get('dateFrom')?.toString() || new Date().toISOString().split('T')[0];
		await scheduleService.assignToEmployee({ employeeId, scheduleId, dateFrom });
		return { success: true };
	},
	removeSchedule: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		await scheduleService.removeEmployeeSchedule(id);
		return { success: true };
	}
};
