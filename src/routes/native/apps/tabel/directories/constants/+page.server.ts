import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/permissions';
import { runAction } from '$lib/server/context/controller';
import { constantsData, constantUpsert, constantDelete } from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user))
		throw redirect(303, '/native/apps/tabel/directories/departments');
	return constantsData(event.url);
};

export const actions: Actions = {
	upsert: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			await constantUpsert(
				event.locals.user,
				f.get('key')?.toString() || '',
				f.get('value')?.toString() || ''
			);
			redirect(302, '/native/apps/tabel/directories/constants');
		}),
	delete: (event) =>
		runAction(async () => {
			const key = (await event.request.formData()).get('key')?.toString();
			await constantDelete(event.locals.user, key);
			redirect(302, '/native/apps/tabel/directories/constants');
		})
};
