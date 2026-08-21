import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { templateCreate, templateDelete } from '$lib/server/apps/tabel/calendar';

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			const name = (await event.request.formData()).get('name')?.toString() || '';
			await templateCreate(event.locals.user, name);
			redirect(303, '/native/apps/tabel/calendar/templates');
		}),

	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await templateDelete(event.locals.user, id);
			redirect(303, '/native/apps/tabel/calendar/templates');
		})
};
