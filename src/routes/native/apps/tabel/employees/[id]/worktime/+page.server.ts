import type { PageServerLoad } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const year = Number(event.url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(event.url.searchParams.get('month')) || new Date().getMonth() + 1;

	const lastDay = new Date(year, month, 0).getDate();
	const from = `${year}-${String(month).padStart(2, '0')}-01`;
	const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

	const [records, calDays, empSchedule, events] = await Promise.all([
		worktimeService.getMonth(id, year, month),
		calendarService
			.getDefaultCalendar(year)
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
		const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const rec = recordByDate.get(dateStr);
		days.push({
			date: dateStr,
			dayMarkCode: rec?.dayMarkCode ?? null,
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

	return { days, year, month, lastDay, empSchedule: empSchedule?.schedule ?? null };
};
