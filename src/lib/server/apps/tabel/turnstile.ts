/**
 * Контроллеры журнала турникетов и рабочей недели сотрудника (worktime).
 */

import { db } from '$lib/server/db';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { getControlledDepartmentIds } from '$lib/server/permissions';
import type { CtrlUser } from '$lib/server/context/controller';

const PAGE_SIZE = 50;

/**
 * Журнал проходов с фильтрами (не-админ — только подконтрольные отделы).
 * defaultMonth: подставлять текущий месяц при пустых датах (native);
 * иначе пустые даты = без фильтра по периоду (modern).
 */
export async function turnstileData(
	user: CtrlUser,
	url: URL,
	opts: { defaultMonth?: boolean } = {}
) {
	const search = url.searchParams.get('search') || '';
	const eventId = url.searchParams.get('eventId') ? Number(url.searchParams.get('eventId')) : null;
	let dateFrom = url.searchParams.get('dateFrom') || '';
	let dateTo = url.searchParams.get('dateTo') || '';

	if (opts.defaultMonth && (!dateFrom || !dateTo)) {
		// По умолчанию — текущий месяц
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const lastDay = String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0');
		dateFrom = dateFrom || `${y}-${m}-01`;
		dateTo = dateTo || `${y}-${m}-${lastDay}`;
	}

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	// Не-админ видит события только сотрудников подконтрольных подразделений
	const departmentIds = await getControlledDepartmentIds(user);

	const [result, eventTypes] = await Promise.all([
		turnstileEventTrackerService.searchWithFilters({
			search,
			eventId,
			dateFrom: dateFrom || null,
			dateTo: dateTo || null,
			page,
			pageSize: PAGE_SIZE,
			departmentIds
		}),
		db.select().from(turnstileEvent).orderBy(turnstileEvent.name)
	]);

	return { ...result, eventTypes, search, eventId, dateFrom, dateTo };
}

const monthRange = (year: number, month: number) => {
	const lastDay = new Date(year, month, 0).getDate();
	return {
		from: `${year}-${String(month).padStart(2, '0')}-01`,
		to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
	};
};

/** Рабочая неделя/месяц сотрудника: дни + справочники расцветки */
export async function employeeWorktimeData(id: number, year?: number, month?: number) {
	const y = year || new Date().getFullYear();
	const m = month || new Date().getMonth() + 1;
	const { from, to } = monthRange(y, m);

	const [records, dayMarks, events, constRows, calDays, empSchedule] = await Promise.all([
		worktimeService.getMonth(id, y, m),
		dayMarkService.list(),
		turnstileEventTrackerService.getByPeriodWithDetails(
			id,
			new Date(from),
			new Date(`${to}T23:59:59`)
		),
		Promise.all([
			appConstantService.getByKey('CELL_COLOR_RULES'),
			appConstantService.getByKey('MARK_COLOR_RULES'),
			appConstantService.getByKey('SHIFT_MARK_SHORTNAMES')
		]),
		calendarService
			.getDefaultCalendar(y)
			.then((cal) => (cal ? calendarService.getDays(cal.id) : [])),
		scheduleService.getCurrentByEmployee(id)
	]);

	const [cellColorRow, markColorRow, shiftMarkRow] = constRows;

	const markByCode = new Map(dayMarks.map((mk) => [mk.code, mk.shortName]));
	const shortToCode = new Map(dayMarks.map((mk) => [mk.shortName, mk.code]));

	let cellColorRules: Record<string, any> = {};
	let markColorRules: Record<string, any> = {};
	let shiftMarks: string[] = [];
	try {
		if (cellColorRow?.value) {
			const parsed = JSON.parse(cellColorRow.value);
			cellColorRules = parsed.light
				? { light: parsed.light, dark: parsed.dark ?? parsed.light }
				: { light: parsed, dark: parsed };
		}
		if (markColorRow?.value) {
			const raw: Record<string, any> = JSON.parse(markColorRow.value);
			const convert = (obj: Record<string, any>) => {
				const out: Record<string, any> = {};
				for (const [key, val] of Object.entries(obj)) {
					out[shortToCode.get(key) ?? key] = val;
				}
				return out;
			};
			markColorRules = raw.light
				? { light: convert(raw.light), dark: convert(raw.dark ?? raw.light) }
				: { light: convert(raw), dark: convert(raw) };
		}
		if (shiftMarkRow?.value) {
			shiftMarks = shiftMarkRow.value
				.split(',')
				.map((s: string) => s.trim())
				.map((sn) => shortToCode.get(sn) ?? sn)
				.filter(Boolean);
		}
	} catch {}

	const calendarDays: Record<string, { dayType: string; workTime: number | null }> = {};
	for (const d of calDays) {
		calendarDays[d.date] = { dayType: d.dayType, workTime: d.workTime };
	}

	const recordByDate = new Map(records.map((r) => [r.date, r]));
	const eventsByDate = new Map<string, typeof events>();
	for (const e of events) {
		const ds = new Date(e.datetime).toISOString().slice(0, 10);
		if (!eventsByDate.has(ds)) eventsByDate.set(ds, []);
		eventsByDate.get(ds)!.push(e);
	}

	const days = [];
	for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
		const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const rec = recordByDate.get(dateStr);
		const rawCode = rec?.reportMarkCode ?? rec?.dayMarkCode ?? '';
		days.push({
			date: dateStr,
			dayMarkCode: markByCode.get(rawCode) ?? rawCode,
			rawWorkTime: rec?.rawWorkTime ?? null,
			rawNightWorkTime: rec?.rawNightWorkTime ?? null,
			shiftWorkTime: rec?.shiftWorkTime ?? null,
			shiftNightWorkTime: rec?.shiftNightWorkTime ?? null,
			reportWorkTime: rec?.reportWorkTime ?? null,
			reportNightWorkTime: rec?.reportNightWorkTime ?? null,
			extraMarkCode: rec?.extraMarkCode ?? null,
			extraMarkMinutes: rec?.extraMarkMinutes ?? null,
			scheduleId: rec?.scheduleId ?? null,
			calendarDay: calendarDays[dateStr] ?? null,
			events: eventsByDate.get(dateStr) ?? []
		});
	}

	return {
		days,
		dayMarks,
		cellColorRules,
		markColorRules,
		shiftMarks,
		calendarDays,
		empSchedule: empSchedule?.schedule ?? null,
		year: y,
		month: m,
		lastDay: new Date(y, m, 0).getDate()
	};
}

/** Рабочий месяц сотрудника (native): лёгкий вариант без справочников расцветки */
export async function employeeWorktimeNativeData(id: number, year?: number, month?: number) {
	const y = year || new Date().getFullYear();
	const m = month || new Date().getMonth() + 1;
	const { from, to } = monthRange(y, m);
	const lastDay = new Date(y, m, 0).getDate();

	const [records, calDays, empSchedule, events] = await Promise.all([
		worktimeService.getMonth(id, y, m),
		calendarService
			.getDefaultCalendar(y)
			.then((cal) => (cal ? calendarService.getDays(cal.id) : [])),
		scheduleService.getCurrentByEmployee(id),
		turnstileEventTrackerService.getByPeriodWithDetails(
			id,
			new Date(`${from}T00:00:00`),
			new Date(`${to}T23:59:59`)
		)
	]);

	const calendarDays = new Map(calDays.map((d: any) => [d.date, d]));
	const recordByDate = new Map(records.map((r: any) => [r.date, r]));
	const eventsByDate = new Map<string, typeof events>();
	for (const e of events) {
		const ds = new Date(e.datetime).toISOString().slice(0, 10);
		if (!eventsByDate.has(ds)) eventsByDate.set(ds, []);
		eventsByDate.get(ds)!.push(e);
	}

	const days = [];
	for (let d = 1; d <= lastDay; d++) {
		const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const rec = recordByDate.get(dateStr);
		days.push({
			date: dateStr,
			dayMarkCode: rec?.reportMarkCode ?? rec?.dayMarkCode ?? null,
			rawWorkTime: rec?.rawWorkTime ?? null,
			rawNightWorkTime: rec?.rawNightWorkTime ?? null,
			shiftWorkTime: rec?.shiftWorkTime ?? null,
			shiftNightWorkTime: rec?.shiftNightWorkTime ?? null,
			reportWorkTime: rec?.reportWorkTime ?? null,
			reportNightWorkTime: rec?.reportNightWorkTime ?? null,
			extraMarkCode: rec?.extraMarkCode ?? null,
			extraMarkMinutes: rec?.extraMarkMinutes ?? null,
			calendarDay: calendarDays.get(dateStr) ?? null,
			events: eventsByDate.get(dateStr) ?? []
		});
	}

	return { days, year: y, month: m, lastDay, empSchedule: empSchedule?.schedule ?? null };
}
