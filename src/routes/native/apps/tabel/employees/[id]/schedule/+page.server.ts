import type { PageServerLoad, Actions } from './$types';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { denyIfCannotEditEmployee, denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const [scheduleHistory, allSchedules] = await Promise.all([
		scheduleService.getHistoryByEmployee(id),
		scheduleService.list()
	]);
	return { scheduleHistory, allSchedules };
};

export const actions: Actions = {
	assignSchedule: async (event) => {
		const employeeId = Number(event.params.id);
		const denied = await denyIfCannotEditEmployee(event.locals.user, employeeId);
		if (denied) return denied;
		const f = await event.request.formData();
		const scheduleId = Number(f.get('scheduleId'));
		const dateFrom = f.get('dateFrom')?.toString() || new Date().toISOString().split('T')[0];

		await scheduleService.assignToEmployee({ employeeId, scheduleId, dateFrom });
		return { success: true };
	},
	updateSchedule: async (event) => {
		const f = await event.request.formData();
		const id = Number(f.get('id'));
		const rec = await scheduleService.getEmployeeScheduleById(id);
		const denied = rec
			? await denyIfCannotEditEmployee(event.locals.user, rec.employeeId)
			: denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const scheduleId = Number(f.get('scheduleId'));
		const dateFrom = f.get('dateFrom')?.toString();
		const dateToRaw = f.get('dateTo')?.toString();
		const dateTo = dateToRaw ? dateToRaw : null;
		await scheduleService.updateEmployeeSchedule(id, { scheduleId, dateFrom, dateTo });
		return { success: true };
	},
	removeSchedule: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		const rec = await scheduleService.getEmployeeScheduleById(id);
		const denied = rec
			? await denyIfCannotEditEmployee(event.locals.user, rec.employeeId)
			: denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		// «Открепить» — закрываем период (dateTo = сегодня), запись остаётся в истории
		const today = new Date().toISOString().split('T')[0];
		await scheduleService.unassignFromEmployee(id, today);
		return { success: true };
	},
	deleteScheduleRecord: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		const rec = await scheduleService.getEmployeeScheduleById(id);
		const denied = rec
			? await denyIfCannotEditEmployee(event.locals.user, rec.employeeId)
			: denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		// Полное удаление записи назначения (для откреплённых графиков)
		await scheduleService.removeEmployeeSchedule(id);
		return { success: true };
	}
};
