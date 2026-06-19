import type { Actions } from './$types';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { redirect } from '@sveltejs/kit';

export const actions: Actions = {
	transfer: async (event) => {
		const id = Number(event.params.id);
		const form = await event.request.formData();
		await documentService.create({
			type: 'transfer',
			date: form.get('date')?.toString() || '',
			docNumber: form.get('docNumber')?.toString() || null,
			employeeId: id,
			departmentId: Number(form.get('departmentId')),
			positionId: Number(form.get('positionId'))
		});
		redirect(302, event.url.pathname);
	},
	dismiss: async (event) => {
		const id = Number(event.params.id);
		const form = await event.request.formData();
		const today = new Date().toISOString().split('T')[0];
		const lastDoc = await documentService.getActiveAtDate(id, today);
		await documentService.create({
			type: 'dismissal',
			date: form.get('date')?.toString() || '',
			docNumber: form.get('docNumber')?.toString() || null,
			employeeId: id,
			departmentId: lastDoc?.departmentId ?? 0,
			positionId: lastDoc?.positionId ?? 0
		});
		redirect(302, `/apps/tabel/employees/${id}/main`);
	},

	cancelDoc: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		await documentService.remove(id);
		return { success: true };
	}
};
