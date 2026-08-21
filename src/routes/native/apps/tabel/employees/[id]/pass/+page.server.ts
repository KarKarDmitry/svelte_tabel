import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { employeePassData, passAssign, passRemove } from '$lib/server/apps/tabel/employees';

export const load: PageServerLoad = async (event) => employeePassData(Number(event.params.id));

export const actions: Actions = {
	assignPass: (event) =>
		runAction(async () => {
			const employeeId = Number(event.params.id);
			const res = await passAssign(event.locals.user, employeeId, await event.request.formData());
			if (res === 'occupied') return fail(409, { error: 'pass_occupied' });
			redirect(302, `/native/apps/tabel/employees/${employeeId}/pass`);
		}),
	removePass: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await passRemove(event.locals.user, id);
			redirect(302, `/native/apps/tabel/employees/${event.params.id}/pass`);
		})
};
