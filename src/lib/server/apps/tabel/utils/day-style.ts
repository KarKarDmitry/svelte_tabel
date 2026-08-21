/**
 * Расцветка обновлённых ячеек табеля для интерактивных эндпоинтов.
 * Единая реализация вместо бывших buildDayStyle (marks) и buildUpdatedStyles
 * (bulk): справочники читаются один раз на батч, native — всегда светлый набор.
 */

import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { cellStyle } from '$lib/apps/tabel/utils/cell-style';

const CONST_KEYS = ['CELL_COLOR_RULES', 'MARK_COLOR_RULES', 'SHIFT_MARK_SHORTNAMES'] as const;

export type StyleEntry = {
	employeeId: number;
	date: string;
	dayMarkCode: string | null;
	reportWorkTime: number | null;
};

/** Расцветка и shortName для списка обновлённых ячеек */
export async function buildStyles(
	entries: StyleEntry[]
): Promise<Array<StyleEntry & { shortName: string; style: string }>> {
	if (entries.length === 0) return [];

	const years = [...new Set(entries.map((e) => Number(e.date.slice(0, 4))))];
	const dates = [...new Set(entries.map((e) => e.date))];
	const empIds = [...new Set(entries.map((e) => e.employeeId))];

	const [calendars, dayMarks, constRows, empSchedules, allSchedules] = await Promise.all([
		calendarService.listByYears(years),
		dayMarkService.list(),
		appConstantService.listByKeys([...CONST_KEYS]),
		scheduleService.listAssignmentsByEmployees(empIds),
		scheduleService.list()
	]);

	// Календарные дни за период (по всем календарям года)
	const calDaysByCal = new Map<number, Map<string, { dayType: string; workTime: number | null }>>();
	for (const cal of calendars) calDaysByCal.set(cal.id, new Map());
	const calRows = await calendarService.listDaysByDates(dates);
	for (const r of calRows) {
		const m = calDaysByCal.get(r.calendarId);
		if (m) m.set(r.date, { dayType: r.dayType, workTime: r.workTime });
	}

	// Константы расцветки (native — всегда светлый набор)
	const constMap = new Map(constRows.map((c) => [c.key, c.value]));
	const parseLight = (key: string): Record<string, any> => {
		const raw = constMap.get(key);
		if (!raw) return {};
		try {
			const parsed = JSON.parse(raw);
			return parsed.light ?? parsed;
		} catch {
			return {};
		}
	};
	const cellColorRules = parseLight('CELL_COLOR_RULES');
	const markColorRulesRaw = parseLight('MARK_COLOR_RULES');
	const shortToCode = new Map(dayMarks.map((m) => [m.shortName, m.code]));
	const codeToShort = new Map(dayMarks.map((m) => [m.code, m.shortName]));
	const markColorRules: Record<string, any> = {};
	for (const [key, val] of Object.entries(markColorRulesRaw)) {
		markColorRules[shortToCode.get(key) ?? key] = val;
	}
	const shiftMarks = (constMap.get('SHIFT_MARK_SHORTNAMES') ?? '')
		.split(',')
		.map((s) => s.trim())
		.map((sn) => shortToCode.get(sn) ?? sn)
		.filter(Boolean);

	// Графики сотрудников
	const esByEmp = new Map<number, typeof empSchedules>();
	for (const es of empSchedules) {
		if (!esByEmp.has(es.employeeId)) esByEmp.set(es.employeeId, []);
		esByEmp.get(es.employeeId)!.push(es);
	}
	const schedulesById: Record<number, { standardWorkTime: number }> = {};
	for (const s of allSchedules) schedulesById[s.id] = { standardWorkTime: s.standardWorkTime };

	const out: Array<StyleEntry & { shortName: string; style: string }> = [];
	for (const e of entries) {
		const year = Number(e.date.slice(0, 4));
		const cal = calendars.find((c) => c.year === year && c.isDefault);
		const calDay = cal ? calDaysByCal.get(cal.id)?.get(e.date) : undefined;

		let sched: { standardWorkTime: number; weekDays: string | null } | undefined;
		let scheduleId: number | null = null;
		const active = (esByEmp.get(e.employeeId) ?? [])
			.filter(
				(es) => (!es.dateFrom || es.dateFrom <= e.date) && (!es.dateTo || es.dateTo >= e.date)
			)
			.sort((a, b) => (a.dateFrom ?? '').localeCompare(b.dateFrom ?? ''))
			.pop();
		if (active) {
			scheduleId = active.scheduleId;
			const s = allSchedules.find((x) => x.id === active.scheduleId);
			if (s) sched = { standardWorkTime: s.standardWorkTime, weekDays: s.weekDays };
		}

		const style = cellStyle(
			{
				date: e.date,
				dayMarkCode: e.dayMarkCode ?? null,
				reportWorkTime: e.reportWorkTime,
				scheduleId,
				blocked: false
			},
			sched,
			{
				shiftMarks,
				calendarDays: calDay ? { [e.date]: calDay } : {},
				schedulesById,
				cellColorRules,
				markColorRules
			}
		);

		out.push({
			...e,
			shortName: e.dayMarkCode ? (codeToShort.get(e.dayMarkCode) ?? e.dayMarkCode) : '',
			style
		});
	}
	return out;
}

/** Расцветка одной ячейки (после точечного обновления отметки) */
export async function buildStyle(
	employeeId: number,
	date: string,
	dayMarkCode: string | null,
	reportWorkTime: number | null
): Promise<string> {
	const [row] = await buildStyles([{ employeeId, date, dayMarkCode, reportWorkTime }]);
	return row.style;
}
