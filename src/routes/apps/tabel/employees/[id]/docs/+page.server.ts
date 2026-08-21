import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { docRehire, docTransfer, docDismiss, docCancel } from '$lib/server/apps/tabel/employees';

export const actions: Actions = {
	rehire: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await docRehire(event.locals.user, id, await event.request.formData());
			redirect(302, event.url.pathname);
		}),
	transfer: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await docTransfer(event.locals.user, id, await event.request.formData());
			redirect(302, event.url.pathname);
		}),
	dismiss: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			await docDismiss(event.locals.user, id, await event.request.formData());
			redirect(302, `/apps/tabel/employees/${id}/main`);
		}),
	cancelDoc: (event) =>
		runAction(async () => {
			const docId = Number((await event.request.formData()).get('id'));
			await docCancel(event.locals.user, docId);
			return { success: true };
		})
};
