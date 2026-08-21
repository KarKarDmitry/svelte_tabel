import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import {
	calendarListData,
	calendarGenerate,
	calendarDelete,
	calendarSetDefault
} from '$lib/server/apps/tabel/calendar';

export const load: PageServerLoad = async () => calendarListData();

export const actions: Actions = {
	generate: (event) =>
		runAction(async () => {
			const cal = await calendarGenerate(event.locals.user, await event.request.formData());
			if (!cal) return { success: false };
			redirect(303, `/apps/tabel/calendar/list/${cal.id}`);
		}),

	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await calendarDelete(event.locals.user, id);
			return { success: true };
		}),

	setDefault: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await calendarSetDefault(event.locals.user, id);
			return { success: true };
		})
};
