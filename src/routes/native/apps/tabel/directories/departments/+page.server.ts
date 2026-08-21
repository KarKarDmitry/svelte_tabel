import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import {
	departmentsData,
	departmentCreate,
	departmentUpdate,
	departmentDelete
} from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async (event) => departmentsData(event.url);

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			const name = (await event.request.formData()).get('name')?.toString();
			await departmentCreate(event.locals.user, name);
			redirect(302, '/native/apps/tabel/directories/departments');
		}),
	update: (event) =>
		runAction(async () => {
			const form = await event.request.formData();
			await departmentUpdate(
				event.locals.user,
				Number(form.get('id')),
				form.get('name')?.toString()
			);
			redirect(302, '/native/apps/tabel/directories/departments');
		}),
	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await departmentDelete(event.locals.user, id);
			redirect(302, '/native/apps/tabel/directories/departments');
		})
};
