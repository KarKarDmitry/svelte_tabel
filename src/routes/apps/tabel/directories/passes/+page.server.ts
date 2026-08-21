import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/permissions';
import { runAction } from '$lib/server/context/controller';
import { passesData, passCreate, passUpdate, passDelete } from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) throw redirect(303, '/apps/tabel/directories');
	return passesData(event.url);
};

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			await passCreate(event.locals.user, await event.request.formData());
			return { success: true };
		}),
	update: (event) =>
		runAction(async () => {
			await passUpdate(event.locals.user, await event.request.formData());
			return { success: true };
		}),
	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await passDelete(event.locals.user, id);
			return { success: true };
		})
};
