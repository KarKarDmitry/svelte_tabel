import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { canEdit, getControlledDepartmentIds } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const url = event.url;
	const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1;

	const [data, groups, calendars, roundingRulesRow] = await Promise.all([
		worktimeService.getMonthGrouped(year, month),
		departmentGroupService.listWithDepartments(),
		calendarService.listCalendars(),
		appConstantService.getByKey('ROUNDING_RULES')
	]);

	let roundingRules: Record<string, unknown> | null = null;
	if (roundingRulesRow?.value) {
		try {
			roundingRules = JSON.parse(roundingRulesRow.value);
		} catch {
			roundingRules = null;
		}
	}

	// Не-админ видит только подконтрольные подразделения
	const controlled = await getControlledDepartmentIds(event.locals.user);
	let departments = data.departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		departments = data.departments.filter((d: any) => set.has(d.id));
	}

	return { ...data, departments, departmentGroups: groups, calendars, roundingRules };
};

/** Проверка прав на изменение данных конкретного сотрудника. Возвращает fail() или null */
async function assertCanEditEmployee(
	event: Parameters<Actions['updateDayMark']>[0],
	employeeId: number,
	date: string
): Promise<ReturnType<Actions['updateDayMark']> | null> {
	if (!canEdit(event.locals.user)) {
		return fail(403, { message: 'Недостаточно прав для редактирования' });
	}
	if (event.locals.user.role !== 'admin') {
		const controlled = await getControlledDepartmentIds(event.locals.user);
		const dept = await employeeService.getDepartmentAtDate(employeeId, date);
		if (!dept || !controlled?.includes(dept.id)) {
			return fail(403, { message: 'Подразделение не подконтрольно' });
		}
	}
	return null;
}

export const actions: Actions = {
	updateDayMark: async (event) => {
		const f = await event.request.formData();
		const employeeId = Number(f.get('employeeId'));
		const date = f.get('date')?.toString() || '';
		const shortName = f.get('shortName')?.toString() || '';

		const denied = await assertCanEditEmployee(event, employeeId, date);
		if (denied) return denied;

		const updatedBy = event.locals.user?.name ?? event.locals.user?.email ?? null;
		const updated = await worktimeService.updateDayMark(employeeId, date, shortName, updatedBy);
		return { success: true, updated };
	},

	updateExtraMark: async (event) => {
		const f = await event.request.formData();
		const employeeId = Number(f.get('employeeId'));
		const date = f.get('date')?.toString() || '';

		const denied = await assertCanEditEmployee(event, employeeId, date);
		if (denied) return denied;

		const extraMarkCode = f.get('extraMarkCode')?.toString() || null;
		const extraMarkMinutesRaw = f.get('extraMarkMinutes')?.toString() || null;
		const extraMarkMinutes = extraMarkMinutesRaw ? Number(extraMarkMinutesRaw) : null;
		const updatedBy = event.locals.user?.name ?? event.locals.user?.email ?? null;

		await worktimeService.updateDayMark(
			employeeId,
			date,
			'',
			updatedBy,
			extraMarkCode,
			!isNaN(extraMarkMinutes ?? NaN) ? extraMarkMinutes : null
		);

		return { success: true };
	}
};
