import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/permissions';
import { runAction } from '$lib/server/context/controller';
import { marksData, markCreate, markUpdate, markDelete } from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user))
		throw redirect(303, '/native/apps/tabel/directories/departments');
	return marksData(event.url);
};

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			await markCreate(event.locals.user, await event.request.formData());
			redirect(302, '/native/apps/tabel/directories/marks');
		}),
	update: (event) =>
		runAction(async () => {
			await markUpdate(event.locals.user, await event.request.formData());
			redirect(302, '/native/apps/tabel/directories/marks');
		}),
	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await markDelete(event.locals.user, id);
			redirect(302, '/native/apps/tabel/directories/marks');
		})
};
