import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';
import { denyIfNotAdmin } from '$lib/server/permissions';

const PAGE_SIZE = 100;

export const load: PageServerLoad = async (event) => {
	const url = event.url;

	const result = await employeeService.searchWithFilters({
		search: url.searchParams.get('search') || '',
		department: url.searchParams.get('department') || '',
		position: url.searchParams.get('position') || '',
		status: url.searchParams.get('status') || '',
		sort: url.searchParams.get('sort') || 'lastName',
		order: url.searchParams.get('order') || 'asc',
		page: Math.max(1, Number(url.searchParams.get('page')) || 1),
		pageSize: PAGE_SIZE
	});

	const deps = await departmentService.list();
	const positions = await positionService.list();

	return {
		...result,
		totalPages: Math.ceil(result.total / PAGE_SIZE),
		page: Math.max(1, Number(url.searchParams.get('page')) || 1),
		departments: deps,
		positions
	};
};

export const actions: Actions = {
	/** Полное удаление сотрудника (каскадом) — только для администраторов */
	delete: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const id = Number(f.get('id'));
		if (!id) return fail(400, { message: 'Неверный ID сотрудника' });
		// FK в БД (hr_document, employee_pass, employee_schedule, leave_document,
		// worktime_tracker, turnstile_event_tracker) имеют ON DELETE CASCADE
		await employeeService.remove(id);
		return { success: true };
	}
};
