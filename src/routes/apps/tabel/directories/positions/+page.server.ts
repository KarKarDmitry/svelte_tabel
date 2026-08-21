import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import {
	positionsData,
	positionCreate,
	positionUpdate,
	positionDelete
} from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async (event) => positionsData(event.url);

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			const name = (await event.request.formData()).get('name')?.toString();
			await positionCreate(event.locals.user, name);
			return { success: true };
		}),
	update: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			await positionUpdate(event.locals.user, Number(f.get('id')), f.get('name')?.toString());
			return { success: true };
		}),
	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await positionDelete(event.locals.user, id);
			return { success: true };
		})
};
