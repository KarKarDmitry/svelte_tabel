import { error } from '@sveltejs/kit';
import { employeeService } from './employee.service';
import { documentService } from './document.service';
import { worktimeService } from './worktime.service';
import { department } from '../tables/department';
import { position } from '../tables/position';
import { dayMark } from '../tables/day-mark';
import { calendar } from '../tables/calendar';
import { calendarDay } from '../tables/calendar-day';
import { schedule } from '../tables/schedule';
import { employeeSchedule } from '../tables/employee-schedule';
import { appConstant } from '../tables/app-constant';
import { turnstileEventTracker } from '../tables/turnstile-event-tracker';
import { turnstileEvent } from '../tables/turnstile-event';
import { pass } from '../tables/pass';
import { db } from '$lib/server/db';
import { eq, and, or, gte, lte, isNull } from 'drizzle-orm';

/**
 * Данные для страницы/модалки «События сотрудника» (GET /apps/tabel/tabel/employee-events).
 * Вынесено в сервис, чтобы native-версия могла вызывать логику напрямую,
 * без HTTP-запроса к собственному origin (в docker-сборке это падает с fetch failed).
 */
export async function getEmployeeEventsData(employeeId: number, year: number, month: number) {
	if (!employeeId || !year || !month) {
		error(400, 'employeeId, year, month are required');
	}

	const from = `${year}-${String(month).padStart(2, '0')}-01`;
	const lastDay = new Date(year, month, 0).getDate();
	const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

	const [emp, activeDoc, trackers] = await Promise.all([
		employeeService.getById(employeeId),
		documentService.getActiveAtDate(employeeId, from),
		worktimeService.getByEmployeeAndPeriod(employeeId, from, to)
	]);

	if (!emp) error(404, 'Employee not found');

	let departmentName: string | null = null;
	let positionName: string | null = null;

	if (activeDoc && activeDoc.type !== 'dismissal') {
		const [dept, pos] = await Promise.all([
			db
				.select({ name: department.name })
				.from(department)
				.where(eq(department.id, activeDoc.departmentId))
				.then((r) => r[0]),
			db
				.select({ name: position.name })
				.from(position)
				.where(eq(position.id, activeDoc.positionId))
				.then((r) => r[0])
		]);
		departmentName = dept?.name ?? null;
		positionName = pos?.name ?? null;
	}

	// События турникета за период (read-only)
	const turnstileEvents = await db
		.select({
			datetime: turnstileEventTracker.datetime,
			eventName: turnstileEvent.name,
			passSeria: pass.seria,
			passNumber: pass.number
		})
		.from(turnstileEventTracker)
		.innerJoin(turnstileEvent, eq(turnstileEvent.id, turnstileEventTracker.eventId))
		.leftJoin(pass, eq(pass.id, turnstileEventTracker.passId))
		.where(
			and(
				eq(turnstileEventTracker.employeeId, employeeId),
				gte(turnstileEventTracker.datetime, new Date(from)),
				lte(turnstileEventTracker.datetime, new Date(to + 'T23:59:59'))
			)
		)
		.orderBy(turnstileEventTracker.datetime);

	// Загружаем справочники, цветовые правила, график и сменные отметки
	const [allMarks, cellRow, markRow, empSchedule, shiftMarkRow] = await Promise.all([
		db.select().from(dayMark),
		db
			.select()
			.from(appConstant)
			.where(eq(appConstant.key, 'CELL_COLOR_RULES'))
			.limit(1)
			.then((r) => r[0]),
		db
			.select()
			.from(appConstant)
			.where(eq(appConstant.key, 'MARK_COLOR_RULES'))
			.limit(1)
			.then((r) => r[0]),
		db
			.select({ standardWorkTime: schedule.standardWorkTime, weekDays: schedule.weekDays })
			.from(employeeSchedule)
			.innerJoin(schedule, eq(employeeSchedule.scheduleId, schedule.id))
			.where(
				and(
					eq(employeeSchedule.employeeId, employeeId),
					or(isNull(employeeSchedule.dateFrom), lte(employeeSchedule.dateFrom, from)),
					or(isNull(employeeSchedule.dateTo), gte(employeeSchedule.dateTo, from))
				)
			)
			.limit(1)
			.then((r) => r[0]),
		db
			.select()
			.from(appConstant)
			.where(eq(appConstant.key, 'SHIFT_MARK_SHORTNAMES'))
			.limit(1)
			.then((r) => r[0])
	]);

	const markByCode = new Map(allMarks.map((m) => [m.code, m.shortName]));
	const shiftMarkValue = shiftMarkRow?.value ?? '';

	let cellColorRules: Record<string, string> = {};
	let markColorRules: Record<string, string> = {};
	try {
		if (cellRow?.value) cellColorRules = JSON.parse(cellRow.value);
		if (markRow?.value) {
			const raw: Record<string, any> = JSON.parse(markRow.value);
			const shortToCode = new Map(allMarks.map((m) => [m.shortName, m.code]));
			markColorRules = {};
			for (const [key, val] of Object.entries(raw)) {
				markColorRules[shortToCode.get(key) ?? key] = val;
			}
		}
	} catch {}

	// Загружаем календарь
	let calendarDayMap = new Map<string, { dayType: string; workTime: number | null }>();
	const cal = await db
		.select({ id: calendar.id })
		.from(calendar)
		.where(and(eq(calendar.year, year), eq(calendar.isDefault, true)))
		.limit(1)
		.then((r) => r[0]);

	if (cal) {
		const calDays = await db
			.select({
				date: calendarDay.date,
				dayType: calendarDay.dayType,
				workTime: calendarDay.workTime
			})
			.from(calendarDay)
			.where(
				and(
					eq(calendarDay.calendarId, cal.id),
					gte(calendarDay.date, from),
					lte(calendarDay.date, to)
				)
			);

		for (const d of calDays) {
			calendarDayMap.set(d.date, { dayType: d.dayType, workTime: d.workTime });
		}
	}

	// Строим массив дней месяца с данными из трекеров
	const days = [];
	for (let d = 1; d <= lastDay; d++) {
		const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		const tracker = trackers.find((t) => t.date === dateStr);
		const rawCode = tracker?.dayMarkCode ?? '';
		days.push({
			date: dateStr,
			reportWorkTime: tracker?.reportWorkTime ?? null,
			reportNightWorkTime: tracker?.reportNightWorkTime ?? null,
			shiftWorkTime: tracker?.shiftWorkTime ?? null,
			shiftNightWorkTime: tracker?.shiftNightWorkTime ?? null,
			dayMarkCode: markByCode.get(rawCode) ?? rawCode,
			extraMarkCode: tracker?.extraMarkCode ?? null,
			extraMarkMinutes: tracker?.extraMarkMinutes ?? null
		});
	}

	return {
		employee: {
			id: emp.id,
			number: emp.number,
			lastName: emp.lastName,
			firstName: emp.firstName,
			middleName: emp.middleName
		},
		departmentName,
		positionName,
		days,
		lastDay,
		cellColorRules,
		markColorRules,
		calendarDays: Object.fromEntries(
			Array.from(calendarDayMap.entries()).map(([k, v]) => [
				typeof k === 'object' && (k as any).toISOString
					? (k as Date).toISOString().split('T')[0]
					: String(k),
				v
			])
		),
		empSchedule,
		turnstileEvents: turnstileEvents.map((e) => ({
			datetime: e.datetime,
			eventName: e.eventName,
			passSeria: e.passSeria,
			passNumber: e.passNumber
		})),
		shiftMarks: shiftMarkValue
			.split(',')
			.map((s: string) => s.trim())
			.filter(Boolean)
			// Конвертируем shortName → code
			.map((sn) => {
				const m = allMarks.find((x: any) => x.shortName === sn);
				return m ? m.code : sn;
			})
			.filter(Boolean)
	};
}
