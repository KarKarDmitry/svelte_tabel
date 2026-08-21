import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { employeeMainUpdate, employeeHire } from '$lib/server/apps/tabel/employees';

export const actions: Actions = {
	update: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await employeeMainUpdate(event.locals.user, id, await event.request.formData());
			return { success: true };
		}),
	hire: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await employeeHire(event.locals.user, id, await event.request.formData());
			redirect(302, `/apps/tabel/employees/${id}/docs`);
		})
};
