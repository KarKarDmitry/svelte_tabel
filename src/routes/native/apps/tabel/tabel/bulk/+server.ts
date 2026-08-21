import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { canEdit, getControlledDepartmentIds } from '$lib/server/permissions';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { cellStyle } from '$lib/apps/tabel/utils/cell-style';

const CONST_KEYS = ['CELL_COLOR_RULES', 'MARK_COLOR_RULES', 'SHIFT_MARK_SHORTNAMES'] as const;

type StyleEntry = {
	employeeId: number;
	date: string;
	dayMarkCode: string | null;
	reportWorkTime: number | null;
	reportNightWorkTime: number | null;
};

/** Расцветка и shortName для списка обновлённых ячеек (справочники читаются один раз) */
async function buildUpdatedStyles(
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

/**
 * Массовое назначение отметок подразделению (XP-версия, обычный JSON без devalue).
 * Вход: form-urlencoded deptId + updates (JSON-массив [{ employeeId, date, shortName, hours }]).
 * Пустая shortName — полная очистка дня; пустой hours — часы не меняем.
 * В ответе — updated[] со стилями ячеек для динамического обновления без reload.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!canEdit(locals.user)) {
		return json({ ok: false, error: 'Недостаточно прав для редактирования' }, { status: 403 });
	}

	const fd = await request.formData();
	const deptId = Number(fd.get('deptId'));
	const updatesRaw = String(fd.get('updates') ?? '');

	if (!deptId || !updatesRaw) {
		return json({ ok: false, error: 'Выберите сотрудников и даты' }, { status: 400 });
	}

	let parsed: Array<{ employeeId: number; date: string; shortName: string; hours: string }>;
	try {
		parsed = JSON.parse(updatesRaw);
	} catch {
		return json({ ok: false, error: 'Некорректный формат обновлений' }, { status: 400 });
	}
	if (!Array.isArray(parsed) || parsed.length === 0) {
		return json({ ok: false, error: 'Выберите сотрудников и даты' }, { status: 400 });
	}

	// Табельщик — только подконтрольные подразделения
	if (locals.user?.role !== 'admin') {
		const controlled = await getControlledDepartmentIds(locals.user);
		if (!controlled?.includes(deptId)) {
			return json({ ok: false, error: 'Подразделение не подконтрольно' }, { status: 403 });
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
			return json({ ok: false, error: 'Некорректная запись обновления' }, { status: 400 });
		}
		let minutes: number | null = null;
		if (hoursRaw) {
			minutes = Math.round(parseFloat(hoursRaw) * 60);
			if (!Number.isFinite(minutes) || minutes < 0) {
				return json({ ok: false, error: 'Некорректное значение часов' }, { status: 400 });
			}
		}
		updates.push({ employeeId, date, shortName, minutes });
	}

	// Табельщик — каждый сотрудник должен принадлежать выбранному подразделению на дату
	if (locals.user?.role !== 'admin') {
		const depts = await employeeService.getDepartmentsAtDates(
			updates.map((u) => ({ employeeId: u.employeeId, date: u.date }))
		);
		for (const u of updates) {
			if (depts.get(`${u.employeeId}-${u.date}`) !== deptId) {
				return json(
					{
						ok: false,
						error: `Сотрудник ${u.employeeId} на ${u.date} не в выбранном подразделении`
					},
					{ status: 403 }
				);
			}
		}
	}

	const updatedBy = locals.user?.name ?? locals.user?.email ?? null;

	try {
		const saved = await worktimeService.bulkUpdateDayMarks(updates, updatedBy);
		const updated = await buildUpdatedStyles(
			saved.map((s) => ({
				employeeId: s.employeeId,
				date: s.date,
				dayMarkCode: s.dayMarkCode,
				reportWorkTime: s.reportWorkTime,
				reportNightWorkTime: s.reportNightWorkTime
			}))
		);
		return json({ ok: true, count: saved.length, updated });
	} catch (err: any) {
		console.error('[native bulkAssign] ошибка:', err);
		if (err?.stack) console.error(err.stack);
		return json(
			{ ok: false, error: 'Не удалось применить назначение: ' + (err?.message ?? String(err)) },
			{ status: 500 }
		);
	}
};
