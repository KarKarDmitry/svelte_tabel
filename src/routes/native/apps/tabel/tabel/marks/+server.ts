import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { denyIfCannotEditEmployee } from '$lib/server/permissions';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { appConstant } from '$lib/server/db/apps/tabel/tables/app-constant';
import { dayMark } from '$lib/server/db/apps/tabel/tables/day-mark';
import { employeeSchedule } from '$lib/server/db/apps/tabel/tables/employee-schedule';
import { schedule } from '$lib/server/db/apps/tabel/tables/schedule';
import { calendar } from '$lib/server/db/apps/tabel/tables/calendar';
import { calendarDay } from '$lib/server/db/apps/tabel/tables/calendar-day';
import { cellStyle } from '$lib/apps/tabel/utils/cell-style';

const CONST_KEYS = ['CELL_COLOR_RULES', 'MARK_COLOR_RULES', 'SHIFT_MARK_SHORTNAMES'] as const;

/** Собирает инлайн-стиль ячейки после обновления (расцветка на лету) */
async function buildDayStyle(
	employeeId: number,
	date: string,
	dayMarkCode: string | null,
	reportWorkTime: number | null
): Promise<string> {
	const year = Number(date.slice(0, 4));

	const [cal, dayMarks, constRows, empSchedules, allSchedules] = await Promise.all([
		db
			.select({ id: calendar.id })
			.from(calendar)
			.where(and(eq(calendar.year, year), eq(calendar.isDefault, true)))
			.limit(1)
			.then((r) => r[0]),
		db.select().from(dayMark),
		db
			.select()
			.from(appConstant)
			.where(inArray(appConstant.key, [...CONST_KEYS])),
		db.select().from(employeeSchedule).where(eq(employeeSchedule.employeeId, employeeId)),
		db
			.select({
				id: schedule.id,
				standardWorkTime: schedule.standardWorkTime,
				weekDays: schedule.weekDays
			})
			.from(schedule)
	]);

	// Календарный день
	let calDay: { dayType: string; workTime: number | null } | undefined;
	if (cal) {
		const row = await db
			.select({ dayType: calendarDay.dayType, workTime: calendarDay.workTime })
			.from(calendarDay)
			.where(and(eq(calendarDay.calendarId, cal.id), eq(calendarDay.date, date)))
			.then((r) => r[0]);
		if (row) calDay = { dayType: row.dayType, workTime: row.workTime };
	}

	// Сменные метки → коды
	const shortToCode = new Map(dayMarks.map((m) => [m.shortName, m.code]));
	const shiftRow = constRows.find((c) => c.key === 'SHIFT_MARK_SHORTNAMES');
	const shiftMarks = (shiftRow?.value ?? '')
		.split(',')
		.map((s: string) => s.trim())
		.map((sn) => shortToCode.get(sn) ?? sn)
		.filter(Boolean);

	// Правила расцветки (native — всегда светлый набор: тёмной темы нет)
	const cellColorRules: Record<string, any> = {};
	const markColorRules: Record<string, any> = {};
	try {
		const c = constRows.find((x) => x.key === 'CELL_COLOR_RULES');
		if (c?.value) {
			const parsed = JSON.parse(c.value);
			Object.assign(cellColorRules, parsed.light ?? parsed);
		}
		const m = constRows.find((x) => x.key === 'MARK_COLOR_RULES');
		if (m?.value) {
			const raw: Record<string, any> = JSON.parse(m.value);
			const source = raw.light ?? raw;
			for (const [key, val] of Object.entries(source)) {
				markColorRules[shortToCode.get(key) ?? key] = val;
			}
		}
	} catch {}

	// Активный график сотрудника на дату
	let sched: { standardWorkTime: number; weekDays: string | null } | undefined;
	let scheduleId: number | null = null;
	const active = empSchedules
		.filter((es) => (!es.dateFrom || es.dateFrom <= date) && (!es.dateTo || es.dateTo >= date))
		.sort((a, b) => (a.dateFrom ?? '').localeCompare(b.dateFrom ?? ''))
		.pop();
	if (active) {
		scheduleId = active.scheduleId;
		const s = allSchedules.find((x) => x.id === active.scheduleId);
		if (s) sched = { standardWorkTime: s.standardWorkTime, weekDays: s.weekDays };
	}

	const schedulesById: Record<number, { standardWorkTime: number }> = {};
	for (const s of allSchedules) schedulesById[s.id] = { standardWorkTime: s.standardWorkTime };

	return cellStyle(
		{ date, dayMarkCode: dayMarkCode ?? null, reportWorkTime, scheduleId, blocked: false },
		sched,
		{
			shiftMarks,
			calendarDays: calDay ? { [date]: calDay } : {},
			schedulesById,
			cellColorRules,
			markColorRules
		}
	);
}

/** Точечное обновление отметки (нативный JS-клиент): обычный JSON, без devalue */
export const POST: RequestHandler = async ({ request, locals }) => {
	const fd = await request.formData();
	const employeeId = Number(fd.get('employeeId'));
	const date = String(fd.get('date') ?? '');
	const shortName = String(fd.get('shortName') ?? '');

	if (!employeeId || !date) {
		throw error(400, 'employeeId и date обязательны');
	}

	// Право проверяем по отделу сотрудника НА ДАТУ ячейки (при переводах отдел
	// мог отличаться от сегодняшнего — иначе табельщик не сможет править
	// «до перевода», даже если подразделение ему подконтрольно)
	const deptAtDate = await employeeService.getDepartmentAtDate(employeeId, date);
	const denied = await denyIfCannotEditEmployee(locals.user, employeeId, deptAtDate?.id);
	if (denied) {
		throw error(403, denied.data?.message ?? 'Недостаточно прав для редактирования');
	}

	const updatedBy = locals.user?.name ?? locals.user?.email ?? null;
	const updated = await worktimeService.updateDayMark(employeeId, date, shortName, updatedBy);

	const style = await buildDayStyle(employeeId, date, updated.dayMarkCode, updated.reportWorkTime);

	return json({ ok: true, updated: { ...updated, style } });
};
