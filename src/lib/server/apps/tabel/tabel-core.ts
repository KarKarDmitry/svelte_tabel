/**
 * Контроллеры ядра табеля: интерактивные операции обоих деревьев.
 * Транспорт (form-urlencoded / JSON / fail / json) адаптируется в роутах.
 */

import {
	getEmployeeEventsData,
	saveEmployeeEvents
} from '$lib/server/db/apps/tabel/services/employee-events.service';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import {
	isAdmin,
	canEdit,
	getControlledDepartmentIds,
	denyIfCannotEditEmployee
} from '$lib/server/permissions';
import { ControllerError } from '$lib/server/context/controller';
import type { CtrlUser } from '$lib/server/context/controller';
import { buildStyles } from './utils/day-style';

export type EmployeeEventDayInput = {
	date: string;
	reportWorkTime: number | null;
	reportNightWorkTime: number | null;
	dayMarkCode: string;
	extraMarkCode?: string | null;
	extraMarkMinutes?: number | null;
};

const updatedByOf = (user: CtrlUser): string | null => user?.name ?? user?.email ?? null;

/** Диалог «События сотрудника»: данные для модалки/диалога */
export async function employeeEventsRead(
	user: CtrlUser,
	employeeId: number,
	year?: number,
	month?: number
) {
	if (!employeeId) throw new ControllerError(400, 'employeeId обязателен');
	const y = year || new Date().getFullYear();
	const m = month || new Date().getMonth() + 1;

	// Не-админ: сотрудник должен быть в подконтрольном отделе (на сегодня)
	if (!isAdmin(user)) {
		const controlled = await getControlledDepartmentIds(user);
		const dep = await employeeService.getDepartmentAtDate(
			employeeId,
			new Date().toISOString().split('T')[0]
		);
		if (!dep || !controlled?.includes(dep.id)) {
			throw new ControllerError(403, 'Доступ запрещён');
		}
	}

	return getEmployeeEventsData(employeeId, y, m);
}

/** Диалог «События сотрудника»: сохранить изменения */
export async function employeeEventsSave(
	user: CtrlUser,
	employeeId: number,
	days: EmployeeEventDayInput[]
): Promise<{ updated: Awaited<ReturnType<typeof saveEmployeeEvents>> }> {
	if (!employeeId || !days?.length) {
		throw new ControllerError(400, 'employeeId and days are required');
	}
	if (!canEdit(user)) {
		throw new ControllerError(403, 'Недостаточно прав для редактирования');
	}
	if (user?.role !== 'admin') {
		const controlled = await getControlledDepartmentIds(user);
		for (const day of days) {
			const mark = day.dayMarkCode.trim();
			if (
				!mark &&
				day.reportWorkTime == null &&
				day.reportNightWorkTime == null &&
				!day.extraMarkCode?.trim()
			)
				continue;
			const dept = await employeeService.getDepartmentAtDate(employeeId, day.date);
			if (!dept || !controlled?.includes(dept.id)) {
				throw new ControllerError(403, 'Подразделение не подконтрольно');
			}
		}
	}

	const updated = await saveEmployeeEvents(employeeId, days, updatedByOf(user));
	return { updated };
}

/** Точечное обновление отметки ячейки (native marks) */
export async function setDayMark(
	user: CtrlUser,
	input: { employeeId: number; date: string; shortName: string }
) {
	const { employeeId, date, shortName } = input;
	if (!employeeId || !date) {
		throw new ControllerError(400, 'employeeId и date обязательны');
	}

	// Право проверяем по отделу сотрудника НА ДАТУ ячейки (при переводах отдел
	// мог отличаться от сегодняшнего — иначе табельщик не сможет править
	// «до перевода», даже если подразделение ему подконтрольно)
	const deptAtDate = await employeeService.getDepartmentAtDate(employeeId, date);
	const denied = await denyIfCannotEditEmployee(user, employeeId, deptAtDate?.id);
	if (denied) {
		throw new ControllerError(403, denied.data?.message ?? 'Недостаточно прав для редактирования');
	}

	const updated = await worktimeService.updateDayMark(
		employeeId,
		date,
		shortName,
		updatedByOf(user)
	);
	// style + shortName — для точечного патча грида без перезагрузки (native)
	const [styled] = await buildStyles([
		{
			employeeId,
			date,
			dayMarkCode: updated.dayMarkCode,
			reportWorkTime: updated.reportWorkTime
		}
	]);

	return { updated, style: styled.style, shortName: styled.shortName };
}

export type BulkUpdateRaw = { employeeId: number; date: string; shortName: string; hours: string };

type BulkUpdate = {
	employeeId: number;
	date: string;
	shortName: string;
	minutes: number | null;
};

/** JSON.parse + проверка массива (порядок валидаций сохранён за исходными версиями) */
function parseBulkRaw(updatesRaw: string): BulkUpdateRaw[] {
	let parsed: BulkUpdateRaw[];
	try {
		parsed = JSON.parse(updatesRaw);
	} catch {
		throw new ControllerError(400, 'Некорректный формат обновлений');
	}
	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new ControllerError(400, 'Выберите сотрудников и даты');
	}
	return parsed;
}

/** Табельщик — только подконтрольные подразделения */
async function assertBulkDept(user: CtrlUser, deptId: number) {
	if (user?.role !== 'admin') {
		const controlled = await getControlledDepartmentIds(user);
		if (!controlled?.includes(deptId)) {
			throw new ControllerError(403, 'Подразделение не подконтрольно');
		}
	}
}

/** Часы задаются построчно; пусто — часы не меняем */
function normalizeBulkItems(parsed: BulkUpdateRaw[]): BulkUpdate[] {
	const updates: BulkUpdate[] = [];
	for (const u of parsed) {
		const employeeId = Number(u?.employeeId);
		const date = String(u?.date ?? '');
		const shortName = String(u?.shortName ?? '').trim();
		const hoursRaw = String(u?.hours ?? '').trim();
		if (!Number.isInteger(employeeId) || employeeId <= 0 || !date) {
			throw new ControllerError(400, 'Некорректная запись обновления');
		}
		let minutes: number | null = null;
		if (hoursRaw) {
			minutes = Math.round(parseFloat(hoursRaw) * 60);
			if (!Number.isFinite(minutes) || minutes < 0) {
				throw new ControllerError(400, 'Некорректное значение часов');
			}
		}
		updates.push({ employeeId, date, shortName, minutes });
	}
	return updates;
}

/** Табельщик — каждый сотрудник должен принадлежать выбранному подразделению на дату */
async function assertBulkEmployeesInDept(user: CtrlUser, deptId: number, updates: BulkUpdate[]) {
	if (user?.role !== 'admin') {
		const depts = await employeeService.getDepartmentsAtDates(
			updates.map((u) => ({ employeeId: u.employeeId, date: u.date }))
		);
		for (const u of updates) {
			if (depts.get(`${u.employeeId}-${u.date}`) !== deptId) {
				throw new ControllerError(
					403,
					`Сотрудник ${u.employeeId} на ${u.date} не в выбранном подразделении`
				);
			}
		}
	}
}

/**
 * Массовое назначение отметок подразделению (native bulk).
 * Пустая shortName — полная очистка дня; пустой hours — часы не меняем.
 */
export async function bulkAssignMarks(
	user: CtrlUser,
	input: { deptId: number; updatesRaw: string }
) {
	if (!canEdit(user)) {
		throw new ControllerError(403, 'Недостаточно прав для редактирования');
	}
	const { deptId, updatesRaw } = input;
	if (!deptId || !updatesRaw) {
		throw new ControllerError(400, 'Выберите сотрудников и даты');
	}

	const parsed = parseBulkRaw(updatesRaw);
	await assertBulkDept(user, deptId);
	const updates = normalizeBulkItems(parsed);
	await assertBulkEmployeesInDept(user, deptId, updates);

	const saved = await worktimeService.bulkUpdateDayMarks(updates, updatedByOf(user));
	const updated = await buildStyles(
		saved.map((s) => ({
			employeeId: s.employeeId,
			date: s.date,
			dayMarkCode: s.dayMarkCode,
			reportWorkTime: s.reportWorkTime
		}))
	);
	return { count: saved.length, updated };
}

/**
 * Массовое назначение отметок (modern form action bulkAssign):
 * та же валидация, ответ без массива стилей (UI перезагружает данные сам).
 */
export async function bulkAssignForm(user: CtrlUser, deptId: number, updatesRaw: string) {
	if (!canEdit(user)) {
		throw new ControllerError(403, 'Недостаточно прав для редактирования');
	}
	if (!deptId || !updatesRaw) {
		throw new ControllerError(400, 'Выберите сотрудников и даты');
	}

	const parsed = parseBulkRaw(updatesRaw);
	await assertBulkDept(user, deptId);
	const updates = normalizeBulkItems(parsed);
	await assertBulkEmployeesInDept(user, deptId, updates);

	try {
		const saved = await worktimeService.bulkUpdateDayMarks(updates, updatedByOf(user));
		return { success: true as const, count: saved.length };
	} catch (err: any) {
		throw new ControllerError(
			500,
			'Не удалось применить назначение: ' + (err?.message ?? String(err))
		);
	}
}

// ---------- Табель: месяц ----------

/** Общее ядро месяца: данные + фильтр отделов по правам + справочники */
async function tabelMonthCore(user: CtrlUser, year: number, month: number) {
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
	const controlled = await getControlledDepartmentIds(user);
	let departments = data.departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		departments = data.departments.filter((d: any) => set.has(d.id));
	}

	return { data, departments, groups, calendars, roundingRules };
}

/** Месяц табеля (modern): плоский список отделов + группы отдельно */
export async function tabelMonthData(user: CtrlUser, url: URL) {
	const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1;
	const core = await tabelMonthCore(user, year, month);

	return {
		...core.data,
		departments: core.departments,
		departmentGroups: core.groups,
		calendars: core.calendars,
		roundingRules: core.roundingRules
	};
}

/** Месяц табеля (native): отделы, сгруппированные по группам (+«Без группы»), light-расцветка */
export async function tabelMonthNativeData(user: CtrlUser, url: URL) {
	const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1;
	const actual = url.searchParams.get('actual') === '1';
	const core = await tabelMonthCore(user, year, month);

	// Группируем по группам подразделений (для отображения)
	const grouped = core.groups
		.map((g) => {
			const deptIds = new Set(g.departments.map((m: any) => m.departmentId));
			return {
				id: g.id,
				name: g.name,
				departments: core.departments.filter((d: any) => deptIds.has(d.id))
			};
		})
		.filter((g) => g.departments.length > 0);
	const inGroup = new Set(grouped.flatMap((g) => g.departments.map((d: any) => d.id)));
	const ungrouped = core.departments.filter((d: any) => !inGroup.has(d.id));
	if (ungrouped.length > 0) {
		grouped.push({ id: 0, name: 'Без группы', departments: ungrouped });
	}

	return {
		...core.data,
		departments: grouped,
		calendars: core.calendars,
		roundingRules: core.roundingRules,
		year,
		month,
		actual,
		canEdit: canEdit(user),
		// native без тёмной темы — отдаём плоский светлый набор расцветки
		cellColorRules: (core.data.cellColorRules as any)?.light ?? core.data.cellColorRules ?? {},
		markColorRules: (core.data.markColorRules as any)?.light ?? core.data.markColorRules ?? {}
	};
}

// ---------- Табель: ячейки (form actions modern-дерева) ----------

/** Права на ячейку: canEdit + отдел сотрудника на дату (без фолбэка «ожидающий») */
async function assertCellEditable(user: CtrlUser, employeeId: number, date: string) {
	if (!canEdit(user)) {
		throw new ControllerError(403, 'Недостаточно прав для редактирования');
	}
	if (user?.role !== 'admin') {
		const controlled = await getControlledDepartmentIds(user);
		const dept = await employeeService.getDepartmentAtDate(employeeId, date);
		if (!dept || !controlled?.includes(dept.id)) {
			throw new ControllerError(403, 'Подразделение не подконтрольно');
		}
	}
}

export async function updateDayMarkCell(
	user: CtrlUser,
	employeeId: number,
	date: string,
	shortName: string
) {
	await assertCellEditable(user, employeeId, date);
	const updated = await worktimeService.updateDayMark(
		employeeId,
		date,
		shortName,
		updatedByOf(user)
	);
	return { updated };
}

export async function updateExtraMarkCell(
	user: CtrlUser,
	employeeId: number,
	date: string,
	extraMarkCode: string | null,
	extraMarkMinutesRaw: string | null
) {
	await assertCellEditable(user, employeeId, date);
	const extraMarkMinutes = extraMarkMinutesRaw ? Number(extraMarkMinutesRaw) : null;
	await worktimeService.updateDayMark(
		employeeId,
		date,
		'',
		updatedByOf(user),
		extraMarkCode,
		!isNaN(extraMarkMinutes ?? NaN) ? extraMarkMinutes : null
	);
}
