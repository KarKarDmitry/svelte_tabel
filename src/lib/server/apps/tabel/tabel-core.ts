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
import {
	isAdmin,
	canEdit,
	getControlledDepartmentIds,
	denyIfCannotEditEmployee
} from '$lib/server/permissions';
import { ControllerError } from '$lib/server/context/controller';
import type { CtrlUser } from '$lib/server/context/controller';
import { buildStyle, buildStyles } from './utils/day-style';

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
	const style = await buildStyle(employeeId, date, updated.dayMarkCode, updated.reportWorkTime);

	return { updated, style };
}

export type BulkUpdateRaw = { employeeId: number; date: string; shortName: string; hours: string };

/**
 * Массовое назначение отметок подразделению.
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

	let parsed: BulkUpdateRaw[];
	try {
		parsed = JSON.parse(updatesRaw);
	} catch {
		throw new ControllerError(400, 'Некорректный формат обновлений');
	}
	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new ControllerError(400, 'Выберите сотрудников и даты');
	}

	// Табельщик — только подконтрольные подразделения
	if (user?.role !== 'admin') {
		const controlled = await getControlledDepartmentIds(user);
		if (!controlled?.includes(deptId)) {
			throw new ControllerError(403, 'Подразделение не подконтрольно');
		}
	}

	// Часы задаются построчно; пусто — не трогаем часы
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

	// Табельщик — каждый сотрудник должен принадлежать выбранному подразделению на дату
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
