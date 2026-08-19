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
	},

	/** Массовое назначение отметок подразделению (сотрудники × даты) */
	bulkAssign: async (event) => {
		if (!canEdit(event.locals.user)) {
			return fail(403, { message: 'Недостаточно прав для редактирования' });
		}

		const f = await event.request.formData();
		const deptId = Number(f.get('deptId'));
		const updatesRaw = f.get('updates')?.toString() || '';

		if (!deptId || !updatesRaw) {
			return fail(400, { message: 'Выберите сотрудников и даты' });
		}

		let parsed: Array<{ employeeId: number; date: string; shortName: string; hours: string }>;
		try {
			parsed = JSON.parse(updatesRaw);
		} catch {
			return fail(400, { message: 'Некорректный формат обновлений' });
		}
		if (!Array.isArray(parsed) || parsed.length === 0) {
			return fail(400, { message: 'Выберите сотрудников и даты' });
		}

		// Табельщик — только подконтрольные подразделения
		if (event.locals.user.role !== 'admin') {
			const controlled = await getControlledDepartmentIds(event.locals.user);
			if (!controlled?.includes(deptId)) {
				return fail(403, { message: 'Подразделение не подконтрольно' });
			}
		}

		// Часы задаются построчно (таблица проверки); пусто — не трогаем часы
		const updates: Array<{
			employeeId: number;
			date: string;
			shortName: string;
			minutes: number | null;
		}> = [];
		for (const u of parsed) {
			const employeeId = Number(u?.employeeId);
			const date = String(u?.date ?? '');
			const shortName = String(u?.shortName ?? '').trim();
			const hoursRaw = String(u?.hours ?? '').trim();
			if (!Number.isInteger(employeeId) || employeeId <= 0 || !date) {
				return fail(400, { message: 'Некорректная запись обновления' });
			}
			let minutes: number | null = null;
			if (hoursRaw) {
				minutes = Math.round(parseFloat(hoursRaw) * 60);
				if (!Number.isFinite(minutes) || minutes < 0) {
					return fail(400, { message: 'Некорректное значение часов' });
				}
			}
			updates.push({ employeeId, date, shortName, minutes });
		}

		// Табельщик — каждый сотрудник должен принадлежать выбранному подразделению на дату
		if (event.locals.user.role !== 'admin') {
			const depts = await employeeService.getDepartmentsAtDates(
				updates.map((u) => ({ employeeId: u.employeeId, date: u.date }))
			);
			for (const u of updates) {
				if (depts.get(`${u.employeeId}-${u.date}`) !== deptId) {
					return fail(403, {
						message: `Сотрудник ${u.employeeId} на ${u.date} не в выбранном подразделении`
					});
				}
			}
		}

		const updatedBy = event.locals.user?.name ?? event.locals.user?.email ?? null;

		console.log('[bulkAssign]', {
			deptId,
			updates: updates.length,
			user: updatedBy
		});

		try {
			const saved = await worktimeService.bulkUpdateDayMarks(updates, updatedBy);
			console.log('[bulkAssign] ok:', saved.length);
			return { success: true, count: saved.length };
		} catch (err: any) {
			console.error('[bulkAssign] ошибка:', err);
			if (err?.stack) console.error(err.stack);
			return fail(500, {
				message: 'Не удалось применить назначение: ' + (err?.message ?? String(err))
			});
		}
	}
};
