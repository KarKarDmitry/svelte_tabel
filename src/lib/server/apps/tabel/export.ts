/**
 * Контроллер экспорта Т-12: общее ядро сборки книги.
 * Параметры отчёта (опции колонок, округление, календарь) передаются как есть —
 * транспортные различия (POST/JSON vs GET/query) живут в шеллах деревьев.
 */

import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { buildT12, type ExportOptions } from '$lib/server/db/apps/tabel/reports/T-12_builder';
import { getControlledDepartmentIds } from '$lib/server/permissions';
import type { CtrlUser } from '$lib/server/context/controller';

export type T12ExportInput = {
	year: number;
	month: number;
	calendarId?: number;
	options?: ExportOptions;
	roundingConfig?: any;
	autoAbsenceMark?: string | null;
};

/** Сборка XLSX-буфера Т-12 с фильтром отделов по правам */
export async function buildT12Workbook(user: CtrlUser, input: T12ExportInput) {
	const { year, month } = input;

	const [data, groups] = await Promise.all([
		worktimeService.getMonthGrouped(year, month, { calendarId: input.calendarId }),
		departmentGroupService.listWithDepartments()
	]);

	// Не-админ экспортирует только подконтрольные подразделения
	const controlled = await getControlledDepartmentIds(user);
	let departments = data.departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		departments = data.departments.filter((d: any) => set.has(d.id));
	}

	// Извлекаем праздничные дни месяца из calendarDays
	const holidays = new Set<number>();
	if (data.calendarDays) {
		for (const [dateStr, dayInfo] of Object.entries(data.calendarDays)) {
			if (dayInfo.dayType === 'holiday') {
				const day = parseInt(dateStr.split('-')[2], 10);
				holidays.add(day);
			}
		}
	}

	const buffer = await buildT12(
		groups,
		departments,
		data.dayMarks,
		year,
		month,
		data.lastDay,
		undefined,
		holidays,
		input.roundingConfig ?? undefined,
		data.calendarDays,
		data.shiftMarks,
		input.options,
		input.autoAbsenceMark ?? undefined
	);

	return buffer;
}

/** Округление из константы ROUNDING_RULES */
export async function roundingRulesFromConstants(): Promise<any> {
	const rules = await appConstantService.getByKey('ROUNDING_RULES');
	try {
		const parsed = rules?.value ? JSON.parse(rules.value) : {};
		return {
			roundingPoint: parsed.roundingPoint ?? null,
			roundingFrom: parsed.roundingFrom ?? null,
			roundingTo: parsed.roundingTo ?? null,
			standardLeft: parsed.standardLeft ?? 0,
			standardRight: parsed.standardRight ?? 0
		};
	} catch {
		return null;
	}
}
