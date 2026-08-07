import type { PageServerLoad, Actions } from './$types';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { redirect } from '@sveltejs/kit';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async () => {
	const calendars = await calendarService.listCalendars();
	const templates = await calendarService.listTemplates();
	return { calendars, templates };
};

export const actions: Actions = {
	generate: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const name = f.get('name')?.toString() || '';
		const templateId = Number(f.get('templateId'));
		const year = Number(f.get('year'));

		const cal = await calendarService.createCalendar({ templateId, year, name });
		if (!cal) return { success: false };

		await calendarService.generateYear(cal.id);

		redirect(303, `/apps/tabel/calendar/list/${cal.id}`);
	},

	delete: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await calendarService.removeCalendar(id);
		return { success: true };
	},

	setDefault: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await calendarService.setDefaultCalendar(id);
		return { success: true };
	}
};
