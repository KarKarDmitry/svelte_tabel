import type { PageServerLoad } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const year = Number(event.url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(event.url.searchParams.get('month')) || new Date().getMonth() + 1;

	const lastDay = new Date(year, month, 0).getDate();
	const from = `${year}-${String(month).padStart(2, '0')}-01`;
	const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

	const [records, dayMarks, events, constRows, calDays, empSchedule] = await Promise.all([
		worktimeService.getMonth(id, year, month),
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
			.getDefaultCalendar(year)
			.then((cal) => (cal ? calendarService.getDays(cal.id) : [])),
		scheduleService.getCurrentByEmployee(id)
	]);

	const [cellColorRow, markColorRow, shiftMarkRow] = constRows;

	const markByCode = new Map(dayMarks.map((m) => [m.code, m.shortName]));
	const shortToCode = new Map(dayMarks.map((m) => [m.shortName, m.code]));

	let cellColorRules: Record<string, any> = {};
	let markColorRules: Record<string, any> = {};
	let shiftMarks: string[] = [];
	try {
		if (cellColorRow?.value) cellColorRules = JSON.parse(cellColorRow.value);
		if (markColorRow?.value) {
			const raw: Record<string, any> = JSON.parse(markColorRow.value);
			markColorRules = {};
			for (const [key, val] of Object.entries(raw)) {
				markColorRules[shortToCode.get(key) ?? key] = val;
			}
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
	for (let d = 1; d <= lastDay; d++) {
		const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const rec = recordByDate.get(dateStr);
		const rawCode = rec?.dayMarkCode ?? '';
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
		year,
		month,
		lastDay
	};
};
