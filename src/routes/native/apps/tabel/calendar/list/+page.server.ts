import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async () => {
	const [calendars, templates] = await Promise.all([
		calendarService.listCalendars(),
		calendarService.listTemplates()
	]);
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

		redirect(303, `/native/apps/tabel/calendar/list/${cal.id}/main`);
	},

	delete: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await calendarService.removeCalendar(id);
		redirect(303, '/native/apps/tabel/calendar/list');
	},

	setDefault: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await calendarService.setDefaultCalendar(id);
		redirect(303, '/native/apps/tabel/calendar/list');
	}
};
