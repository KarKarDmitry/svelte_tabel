import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { employeeCreateData, employeeCreate } from '$lib/server/apps/tabel/employees';

export const load: PageServerLoad = async (event) => employeeCreateData(event.locals.user);

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			const emp = await employeeCreate(event.locals.user, await event.request.formData());
			redirect(302, `/apps/tabel/employees/${emp.id}`);
		})
};
