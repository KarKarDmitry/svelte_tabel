import type { PageServerLoad, Actions } from './$types';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const rules = await calendarService.getRules(id);
	return { rules };
};

export const actions: Actions = {
	createRule: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const templateId = Number(event.params.id);
		const f = await event.request.formData();
		await calendarService.createRule({
			templateId,
			month: Number(f.get('month')),
			day: Number(f.get('day')),
			autoTransfer: f.get('autoTransfer') === 'on',
			preHoliday: f.get('preHoliday') === 'on',
			preScheduleId: f.get('preScheduleId') ? Number(f.get('preScheduleId')) : null
		});
		return { success: true };
	},
	updateRule: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		await calendarService.updateRule(Number(f.get('id')), {
			month: Number(f.get('month')),
			day: Number(f.get('day')),
			autoTransfer: f.get('autoTransfer') === 'on',
			preHoliday: f.get('preHoliday') === 'on',
			preScheduleId: f.get('preScheduleId') ? Number(f.get('preScheduleId')) : null
		});
		return { success: true };
	},
	deleteRule: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await calendarService.removeRule(id);
		return { success: true };
	}
};
