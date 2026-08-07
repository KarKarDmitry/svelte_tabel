import type { Actions } from './$types';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { fail, redirect } from '@sveltejs/kit';
import { denyIfCannotEditEmployee } from '$lib/server/permissions';

export const actions: Actions = {
	update: async (event) => {
		const id = Number(event.params.id);
		const denied = await denyIfCannotEditEmployee(event.locals.user, id);
		if (denied) return denied;

		const form = await event.request.formData();
		const number = form.get('number')?.toString() || undefined;

		// Номер занят другим сотрудником — подсказываем, что делать
		if (number) {
			const existing = await employeeService.getByNumber(number);
			if (existing && existing.id !== id) {
				return fail(409, {
					error: 'number_taken',
					existing: {
						id: existing.id,
						number: existing.number,
						lastName: existing.lastName,
						firstName: existing.firstName,
						middleName: existing.middleName
					}
				});
			}
		}

		await employeeService.update(id, {
			lastName: form.get('lastName')?.toString() || undefined,
			firstName: form.get('firstName')?.toString() || undefined,
			middleName: form.get('middleName')?.toString() || undefined,
			number: form.get('number')?.toString() || undefined
		});
		redirect(302, `/native/apps/tabel/employees/${id}/main`);
	},

	hire: async (event) => {
		const id = Number(event.params.id);
		const form = await event.request.formData();
		const denied = await denyIfCannotEditEmployee(
			event.locals.user,
			id,
			Number(form.get('departmentId'))
		);
		if (denied) return denied;

		await documentService.create({
			type: 'hiring',
			date: form.get('date')?.toString() || new Date().toISOString().split('T')[0],
			docNumber: form.get('docNumber')?.toString() || null,
			employeeId: id,
			departmentId: Number(form.get('departmentId')),
			positionId: Number(form.get('positionId'))
		});
		redirect(302, `/native/apps/tabel/employees/${id}/main`);
	}
};
