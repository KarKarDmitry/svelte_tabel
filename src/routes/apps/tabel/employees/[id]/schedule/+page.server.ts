import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import {
	employeeScheduleData,
	scheduleAssign,
	scheduleUpdate,
	scheduleRemove,
	scheduleDeleteRecord
} from '$lib/server/apps/tabel/employees';

export const load: PageServerLoad = async (event) => employeeScheduleData(Number(event.params.id));

export const actions: Actions = {
	assignSchedule: (event) =>
		runAction(async () => {
			const employeeId = Number(event.params.id);
			await scheduleAssign(event.locals.user, employeeId, await event.request.formData());
			return { success: true };
		}),
	updateSchedule: (event) =>
		runAction(async () => {
			await scheduleUpdate(event.locals.user, await event.request.formData());
			return { success: true };
		}),
	removeSchedule: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await scheduleRemove(event.locals.user, id);
			return { success: true };
		}),
	deleteScheduleRecord: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await scheduleDeleteRecord(event.locals.user, id);
			return { success: true };
		})
};
