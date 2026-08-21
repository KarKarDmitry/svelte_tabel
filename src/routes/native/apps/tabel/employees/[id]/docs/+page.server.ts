import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { docRehire, docTransfer, docDismiss, docCancel } from '$lib/server/apps/tabel/employees';

export const actions: Actions = {
	rehire: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await docRehire(event.locals.user, id, await event.request.formData());
			redirect(302, `/native/apps/tabel/employees/${id}/docs`);
		}),
	transfer: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await docTransfer(event.locals.user, id, await event.request.formData());
			redirect(302, `/native/apps/tabel/employees/${id}/docs`);
		}),
	dismiss: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await docDismiss(event.locals.user, id, await event.request.formData());
			redirect(302, `/native/apps/tabel/employees/${id}/docs`);
		}),
	cancelDoc: (event) =>
		runAction(async () => {
			const docId = Number((await event.request.formData()).get('id'));
			await docCancel(event.locals.user, docId);
			redirect(302, `/native/apps/tabel/employees/${event.params.id}/docs`);
		})
};
