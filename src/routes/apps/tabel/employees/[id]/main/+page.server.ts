import type { Actions } from './$types';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { redirect } from '@sveltejs/kit';

export const actions: Actions = {
	update: async (event) => {
		const id = Number(event.params.id);
		const form = await event.request.formData();
		await employeeService.update(id, {
			lastName: form.get('lastName')?.toString() || undefined,
			firstName: form.get('firstName')?.toString() || undefined,
			middleName: form.get('middleName')?.toString() || undefined,
			number: form.get('number')?.toString() || undefined
		});
		return { success: true };
	},
	hire: async (event) => {
		const id = Number(event.params.id);
		const form = await event.request.formData();
		await documentService.create({
			type: 'hiring',
			date: form.get('date')?.toString() || new Date().toISOString().split('T')[0],
			docNumber: form.get('docNumber')?.toString() || null,
			employeeId: id,
			departmentId: Number(form.get('departmentId')),
			positionId: Number(form.get('positionId'))
		});
		redirect(302, `/apps/tabel/employees/${id}/docs`);
	}
};
