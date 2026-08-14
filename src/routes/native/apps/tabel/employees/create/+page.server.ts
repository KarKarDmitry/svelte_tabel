import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';
import { denyIfCannotEditEmployee, getControlledDepartmentIds } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const [departments, positions] = await Promise.all([
		departmentService.list(),
		positionService.list()
	]);
	// Табельщик видит только подконтрольные отделы (админ — все)
	const controlled = await getControlledDepartmentIds(event.locals.user);
	let visibleDepartments = departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		visibleDepartments = departments.filter((d) => set.has(d.id));
	}
	return { departments: visibleDepartments, positions };
};

export const actions: Actions = {
	create: async (event) => {
		const form = await event.request.formData();
		const denied = await denyIfCannotEditEmployee(
			event.locals.user,
			0,
			Number(form.get('departmentId'))
		);
		if (denied) return denied;

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

		// Табельный номер должен быть свободен
		const existing = await employeeService.getByNumber(number);
		if (existing) {
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

		let emp;
		try {
			emp = await employeeService.create({
				number,
				lastName,
				firstName,
				middleName: middleName || null
			});
		} catch (e: any) {
			// Редкая гонка: уникальность номера держит БД (23505 = unique_violation)
			if (e?.code === '23505') {
				const dup = await employeeService.getByNumber(number);
				if (dup) {
					return fail(409, {
						error: 'number_taken',
						existing: {
							id: dup.id,
							number: dup.number,
							lastName: dup.lastName,
							firstName: dup.firstName,
							middleName: dup.middleName
						}
					});
				}
			}
			throw e;
		}

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

		throw redirect(302, `/native/apps/tabel/employees/${emp.id}/main`);
	}
};
