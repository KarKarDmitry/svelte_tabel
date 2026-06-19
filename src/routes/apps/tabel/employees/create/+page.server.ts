import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';

export const load: PageServerLoad = async () => {
	const [departments, positions] = await Promise.all([
		departmentService.list(),
		positionService.list()
	]);
	return { departments, positions };
};

export const actions: Actions = {
	create: async (event) => {
		const form = await event.request.formData();
		const number = form.get('number')?.toString() || '';
		const lastName = form.get('lastName')?.toString() || '';
		const firstName = form.get('firstName')?.toString() || '';
		const middleName = form.get('middleName')?.toString() || '';
		const departmentId = Number(form.get('departmentId'));
		const positionId = Number(form.get('positionId'));
		const date = form.get('date')?.toString() || new Date().toISOString().split('T')[0];
		const docNumber = form.get('docNumber')?.toString() || null;

		if (!number || !lastName || !firstName) {
			return fail(400, { message: 'Заполните ФИО и табельный номер' });
		}

		const emp = await employeeService.create({
			number,
			lastName,
			firstName,
			middleName: middleName || null
		});

		if (departmentId && positionId) {
			await documentService.create({
				type: 'hiring',
				date,
				docNumber,
				employeeId: emp.id,
				departmentId,
				positionId
			});
		}

		throw redirect(302, `/apps/tabel/employees/${emp.id}`);
	}
};
