import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { isAdmin, canEdit, getControlledDepartmentIds } from '$lib/server/permissions';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';

/** Нативная страница сотрудника: данные переиспользуем у GET /apps/tabel/tabel/employee-events */
export const load: PageServerLoad = async (event) => {
	const employeeId = Number(event.params.id);
	const year = Number(event.url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(event.url.searchParams.get('month')) || new Date().getMonth() + 1;

	if (!employeeId) throw error(400, 'Неверный ID');

	// Не-админ: сотрудник должен быть в подконтрольном отделе
	if (!isAdmin(event.locals.user)) {
		const controlled = await getControlledDepartmentIds(event.locals.user);
		const dep = await employeeService.getDepartmentAtDate(
			employeeId,
			new Date().toISOString().split('T')[0]
		);
		if (!dep || !controlled?.includes(dep.id)) {
			throw error(403, 'Доступ запрещён');
		}
	}

	const cookie = event.request.headers.get('cookie') ?? '';
	const res = await fetch(
		new URL(
			`/apps/tabel/tabel/employee-events?employeeId=${employeeId}&year=${year}&month=${month}`,
			event.url.origin
		),
		{ headers: { cookie } }
	);

	if (!res.ok) {
		throw error(res.status, 'Не удалось загрузить данные сотрудника');
	}

	const data = await res.json();
	return { ...data, employeeId, year, month, canEdit: canEdit(event.locals.user) };
};
