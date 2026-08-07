import type { PageServerLoad, Actions } from './$types';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { redirect } from '@sveltejs/kit';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async () => {
	const templates = await calendarService.listTemplates();
	return { templates };
};

export const actions: Actions = {
	create: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const name = f.get('name')?.toString() || '';
		const defaultWorkDays = JSON.stringify([1, 2, 3, 4, 5]);
		const defaultWorkTime = 480;
		const tpl = await calendarService.createTemplate({
			name,
			year: 0,
			defaultWorkDays,
			defaultWorkTime
		});
		redirect(303, `/apps/tabel/calendar/templates/${tpl.id}/main`);
	},

	delete: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await calendarService.removeTemplate(id);
		return { success: true };
	}
};
