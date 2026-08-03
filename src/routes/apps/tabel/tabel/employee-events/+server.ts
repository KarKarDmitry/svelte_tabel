import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { department } from '$lib/server/db/apps/tabel/tables/department';
import { position } from '$lib/server/db/apps/tabel/tables/position';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { worktimeTracker } from '$lib/server/db/apps/tabel/tables/worktime-tracker';
import { dayMark } from '$lib/server/db/apps/tabel/tables/day-mark';
import { calendar } from '$lib/server/db/apps/tabel/tables/calendar';
import { calendarDay } from '$lib/server/db/apps/tabel/tables/calendar-day';
import { schedule } from '$lib/server/db/apps/tabel/tables/schedule';
import { employeeSchedule } from '$lib/server/db/apps/tabel/tables/employee-schedule';
import { appConstant } from '$lib/server/db/apps/tabel/tables/app-constant';
import { turnstileEventTracker } from '$lib/server/db/apps/tabel/tables/turnstile-event-tracker';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';
import { pass } from '$lib/server/db/apps/tabel/tables/pass';
import { db } from '$lib/server/db';
import { eq, and, or, gte, lte, isNull } from 'drizzle-orm';

/** GET: загрузить данные для модального окна */
export const GET: RequestHandler = async ({ url }) => {
	const employeeId = Number(url.searchParams.get('employeeId'));
	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month'));

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
			dayMarkCode: markByCode.get(rawCode) ?? rawCode,
			extraMarkCode: tracker?.extraMarkCode ?? null,
			extraMarkMinutes: tracker?.extraMarkMinutes ?? null
		});
	}

	return json({
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
	});
};

/** POST: сохранить изменения из модального окна */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { employeeId, year, month, days } = (await request.json()) as {
		employeeId: number;
		year: number;
		month: number;
		days: Array<{
			date: string;
			reportWorkTime: number | null;
			reportNightWorkTime: number | null;
			dayMarkCode: string;
			extraMarkCode?: string | null;
			extraMarkMinutes?: number | null;
		}>;
	};

	if (!employeeId || !days?.length) {
		error(400, 'employeeId and days are required');
	}

	const updatedBy = locals.user?.name ?? locals.user?.email ?? null;
	const updated: Array<{
		employeeId: number;
		date: string;
		reportWorkTime: number | null;
		reportNightWorkTime: number | null;
		dayMarkCode: string | null;
		extraMarkCode?: string | null;
		extraMarkMinutes?: number | null;
	}> = [];

	for (const day of days) {
		const mark = day.dayMarkCode.trim();
		if (
			!mark &&
			day.reportWorkTime == null &&
			day.reportNightWorkTime == null &&
			!day.extraMarkCode?.trim()
		)
			continue;

		const result = await worktimeService.updateDayMark(
			employeeId,
			day.date,
			mark,
			updatedBy,
			day.extraMarkCode?.trim() || null,
			day.extraMarkMinutes ?? null
		);

		const explicitHours = day.reportWorkTime !== undefined && day.reportWorkTime !== null;
		const explicitNight = day.reportNightWorkTime !== undefined && day.reportNightWorkTime !== null;

		if (
			explicitHours ||
			explicitNight ||
			day.extraMarkCode?.trim() ||
			day.extraMarkMinutes != null
		) {
			const setData: any = {};
			if (explicitHours) setData.reportWorkTime = day.reportWorkTime;
			if (explicitNight) setData.reportNightWorkTime = day.reportNightWorkTime;
			if (day.extraMarkCode?.trim()) setData.extraMarkCode = day.extraMarkCode.trim();
			if (day.extraMarkMinutes != null) setData.extraMarkMinutes = day.extraMarkMinutes;

			if (Object.keys(setData).length > 0) {
				await db
					.update(worktimeTracker)
					.set(setData)
					.where(
						and(eq(worktimeTracker.employeeId, employeeId), eq(worktimeTracker.date, day.date))
					);
			}
		}

		updated.push({
			employeeId,
			date: day.date,
			reportWorkTime: day.reportWorkTime ?? result.reportWorkTime,
			reportNightWorkTime: day.reportNightWorkTime ?? result.reportNightWorkTime,
			dayMarkCode: mark || result.dayMarkCode,
			extraMarkCode: day.extraMarkCode?.trim() || result.extraMarkCode || null,
			extraMarkMinutes: day.extraMarkMinutes ?? result.extraMarkMinutes ?? null
		});
	}

	return json({ updated });
};
