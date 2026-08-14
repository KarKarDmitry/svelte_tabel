import { db } from '$lib/server/db';
import { worktimeTracker } from '../tables/worktime-tracker';
import { employee } from '../tables/employee';
import { hrDocument } from '../tables/document';
import { department } from '../tables/department';
import { position } from '../tables/position';
import { dayMark } from '../tables/day-mark';
import { appConstant } from '../tables/app-constant';
import { schedule } from '../tables/schedule';
import { employeeSchedule } from '../tables/employee-schedule';
import { calendar } from '../tables/calendar';
import { calendarDay } from '../tables/calendar-day';
import { eq, and, asc, between, desc, gte, lte, sql } from 'drizzle-orm';
import { buildEmployeeSegments } from './employee-segments';

/** Получить из app_constant множество shortName отметок, при простановке которых подставляются часы из графика */
async function getShiftMarkShortnames(): Promise<Set<string>> {
	const row = await db
		.select()
		.from(appConstant)
		.where(eq(appConstant.key, 'SHIFT_MARK_SHORTNAMES'))
		.limit(1)
		.then((r) => r[0]);

	if (!row?.value) return new Set();
	return new Set(
		row.value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);
}

/**
 * Сотрудники, видимые в табеле за месяц:
 * все, кроме уволенных (последний документ ≤ конца месяца — увольнение),
 * у которых нет записей worktime_tracker за этот месяц.
 */
async function getVisibleEmployees(year: number, month: number) {
	const from = `${year}-${String(month).padStart(2, '0')}-01`;
	const lastDay = new Date(year, month, 0).getDate();
	const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

	// Все сотрудники, кроме уволенных (последний документ ≤ конца месяца — увольнение),
	// у которых нет записей worktime_tracker за этот месяц
	return db
		.select()
		.from(employee)
		.where(
			sql`NOT (
				(SELECT d.type FROM ${hrDocument} d
				 WHERE d.employee_id = ${employee.id} AND d.date <= ${to}
				 ORDER BY d.date DESC, d.id DESC LIMIT 1) = 'dismissal'
				AND NOT EXISTS (
					SELECT 1 FROM ${worktimeTracker} w
					WHERE w.employee_id = ${employee.id} AND w.date BETWEEN ${from} AND ${to}
				)
			)`
		)
		.orderBy(employee.lastName, employee.firstName);
}

export const worktimeService = {
	/** Сотрудники, видимые в табеле за месяц (не уволенные + уволенные с данными) */
	getVisibleEmployees,

	getMonth: (employeeId: number, year: number, month: number) => {
		const from = `${year}-${String(month).padStart(2, '0')}-01`;
		const lastDay = new Date(year, month, 0).getDate();
		const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
		return worktimeService.getByEmployeeAndPeriod(employeeId, from, to);
	},

	getByEmployeeAndPeriod: (employeeId: number, start: string, end: string) =>
		db
			.select()
			.from(worktimeTracker)
			.where(
				and(eq(worktimeTracker.employeeId, employeeId), between(worktimeTracker.date, start, end))
			)
			.orderBy(worktimeTracker.date),

	/** Получить табель за месяц, сгруппированный по отделам */
	getMonthGrouped: async (
		year: number,
		month: number,
		params?: {
			calendarId?: number;
			onStage?: (stage: string) => void;
		}
	) => {
		const onStage = params?.onStage;

		onStage?.('Загрузка сотрудников…');

		const from = `${year}-${String(month).padStart(2, '0')}-01`;
		const lastDay = new Date(year, month, 0).getDate();
		const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
		const monthStart = from;
		const monthEnd = to;

		// --- Получаем видимых сотрудников (не уволенные + уволенные с данными за месяц) ---
		const allEmployees = await getVisibleEmployees(year, month);
		const empById = new Map(allEmployees.map((e) => [e.id, e]));

		// --- Получаем ВСЕ HR-документы, группируем по сотруднику, сортируем по дате ASC ---
		const allDocs = await db
			.select()
			.from(hrDocument)
			.where(lte(hrDocument.date, monthEnd))
			.orderBy(asc(hrDocument.date));

		const docsByEmployee = new Map<number, (typeof hrDocument.$inferSelect)[]>();
		for (const doc of allDocs) {
			if (!docsByEmployee.has(doc.employeeId)) {
				docsByEmployee.set(doc.employeeId, []);
			}
			docsByEmployee.get(doc.employeeId)!.push(doc);
		}

		// --- Справочники ---
		onStage?.('Загрузка справочников…');
		const allDepts = await db.select().from(department);
		const allPositions = await db.select().from(position);
		const deptById = new Map(allDepts.map((d) => [d.id, d]));
		const posById = new Map(allPositions.map((p) => [p.id, p]));

		// --- Строим расширенный список: каждый сотрудник → несколько записей по сегментам ---
		type SegEntry = {
			id: number;
			number: string;
			lastName: string;
			firstName: string;
			middleName: string | null;
			departmentId: number | null;
			departmentName: string | null;
			positionId: number | null;
			positionName: string | null;
			segmentFrom: string;
			segmentTo: string;
		};

		const expanded: SegEntry[] = [];

		for (const emp of allEmployees) {
			const docs = docsByEmployee.get(emp.id) ?? [];
			const segments = buildEmployeeSegments(docs, monthStart, monthEnd, deptById, posById);

			for (const seg of segments) {
				expanded.push({
					id: emp.id,
					number: emp.number,
					lastName: emp.lastName,
					firstName: emp.firstName,
					middleName: emp.middleName,
					departmentId: seg.departmentId,
					departmentName: seg.departmentName,
					positionId: seg.positionId,
					positionName: seg.positionName,
					segmentFrom: seg.dateFrom,
					segmentTo: seg.dateTo
				});
			}
		}

		// Сортируем по отделу, затем по фамилии
		expanded.sort((a, b) => {
			const deptA = a.departmentName ?? '';
			const deptB = b.departmentName ?? '';
			const cmp = deptA.localeCompare(deptB);
			if (cmp !== 0) return cmp;
			return (a.lastName ?? '').localeCompare(b.lastName ?? '');
		});

		// --- Получаем записи табеля за месяц ---
		onStage?.('Загрузка табеля…');
		const records = await db
			.select()
			.from(worktimeTracker)
			.where(and(gte(worktimeTracker.date, from), lte(worktimeTracker.date, to)))
			.orderBy(worktimeTracker.date);

		const recordMap = new Map<string, any>();
		for (const r of records) recordMap.set(`${r.employeeId}-${r.date}`, r);

		// --- Загружаем графики сотрудников ---
		onStage?.('Загрузка графиков…');
		const empSchedules = await db
			.select({
				employeeId: employeeSchedule.employeeId,
				scheduleId: employeeSchedule.scheduleId,
				standardWorkTime: schedule.standardWorkTime,
				weekDays: schedule.weekDays,
				dateFrom: employeeSchedule.dateFrom,
				dateTo: employeeSchedule.dateTo
			})
			.from(employeeSchedule)
			.innerJoin(schedule, eq(employeeSchedule.scheduleId, schedule.id));

		const scheduleMap = new Map<
			number,
			{ scheduleId: number; standardWorkTime: number; weekDays: string | null }[]
		>();

		for (const es of empSchedules) {
			if (es.dateFrom && es.dateFrom > monthEnd) continue;
			if (es.dateTo && es.dateTo < monthStart) continue;
			if (!scheduleMap.has(es.employeeId)) {
				scheduleMap.set(es.employeeId, []);
			}
			scheduleMap.get(es.employeeId)!.push({
				scheduleId: es.scheduleId,
				standardWorkTime: es.standardWorkTime,
				weekDays: es.weekDays
			});
		}

		// --- Загружаем данные календаря ---
		onStage?.('Загрузка календаря…');
		let calendarDayMap = new Map<string, { dayType: string; workTime: number | null }>();
		const cal = await db
			.select({ id: calendar.id })
			.from(calendar)
			.where(
				params?.calendarId
					? and(eq(calendar.id, params.calendarId), eq(calendar.year, year))
					: and(eq(calendar.year, year), eq(calendar.isDefault, true))
			)
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
						gte(calendarDay.date, monthStart),
						lte(calendarDay.date, monthEnd)
					)
				);
			for (const d of calDays) {
				calendarDayMap.set(d.date, { dayType: d.dayType, workTime: d.workTime });
			}
		}

		// --- Группируем по отделам ---
		const deptMap = new Map<number, { id: number; name: string; employees: any[] }>();
		for (const entry of expanded) {
			const deptId = entry.departmentId ?? 0;
			if (!deptMap.has(deptId)) {
				deptMap.set(deptId, {
					id: deptId,
					name: entry.departmentName ?? 'Без отдела',
					employees: []
				});
			}
			const dept = deptMap.get(deptId)!;

			const days: any[] = [];
			let totalReport = 0,
				totalNight = 0;

			for (let d = 1; d <= lastDay; d++) {
				const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

				// День вне сегмента → blocked
				const inSegment = dateStr >= entry.segmentFrom && dateStr <= entry.segmentTo;

				if (!inSegment) {
					days.push({
						date: dateStr,
						blocked: true,
						reportWorkTime: null,
						reportNightWorkTime: null,
						shiftWorkTime: null,
						shiftNightWorkTime: null,
						rawWorkTime: null,
						rawNightWorkTime: null,
						dayMarkCode: '',
						extraMarkCode: null,
						extraMarkMinutes: null,
						scheduleId: null
					});
					continue;
				}

				const rec = recordMap.get(`${entry.id}-${dateStr}`);
				days.push({
					date: dateStr,
					blocked: false,
					reportWorkTime: rec?.reportWorkTime ?? null,
					reportNightWorkTime: rec?.reportNightWorkTime ?? null,
					shiftWorkTime: rec?.shiftWorkTime ?? null,
					shiftNightWorkTime: rec?.shiftNightWorkTime ?? null,
					rawWorkTime: rec?.rawWorkTime ?? null,
					rawNightWorkTime: rec?.rawNightWorkTime ?? null,
					dayMarkCode: rec?.dayMarkCode ?? '',
					extraMarkCode: rec?.extraMarkCode ?? null,
					extraMarkMinutes: rec?.extraMarkMinutes ?? null,
					scheduleId: rec?.scheduleId ?? null
				});
				totalReport += rec?.reportWorkTime ?? rec?.shiftWorkTime ?? 0;
				totalNight += rec?.reportNightWorkTime ?? rec?.shiftNightWorkTime ?? 0;
			}

			dept.employees.push({
				id: entry.id,
				number: entry.number,
				lastName: entry.lastName,
				firstName: entry.firstName,
				middleName: entry.middleName,
				departmentId: entry.departmentId,
				departmentName: entry.departmentName,
				positionId: entry.positionId,
				positionName: entry.positionName,
				days,
				totalReport,
				totalNight,
				schedule: (scheduleMap.get(entry.id) ?? [])[0] ?? null,
				segmentFrom: entry.segmentFrom,
				segmentTo: entry.segmentTo
			});
		}

		const dayMarks = await db.select().from(dayMark);

		// Загружаем цветовые правила и shiftMarks
		const [cellColorRow, markColorRow, shiftMarkRow] = await Promise.all([
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
				.select()
				.from(appConstant)
				.where(eq(appConstant.key, 'SHIFT_MARK_SHORTNAMES'))
				.limit(1)
				.then((r) => r[0])
		]);

		let cellColorRules: Record<string, any> = {};
		let markColorRules: Record<string, any> = {};
		let shiftMarkShortnames: string[] = [];

		try {
			if (cellColorRow?.value) {
				const parsed = JSON.parse(cellColorRow.value);
				// Новый формат { light, dark }; старый — считаем светлым набором
				cellColorRules = parsed.light
					? { light: parsed.light, dark: parsed.dark ?? parsed.light }
					: { light: parsed, dark: parsed };
			}
			if (markColorRow?.value) {
				const raw: Record<string, any> = JSON.parse(markColorRow.value);
				// Конвертируем ключи из shortName в code (на случай старых данных)
				const shortToCode = new Map(dayMarks.map((m) => [m.shortName, m.code]));
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
				shiftMarkShortnames = shiftMarkRow.value
					.split(',')
					.map((s: string) => s.trim())
					.filter(Boolean);
			}
			// Конвертируем shortName → code для shiftMarks
			const shortToCode = new Map(dayMarks.map((m: any) => [m.shortName, m.code]));
			shiftMarkShortnames = shiftMarkShortnames
				.map((sn) => shortToCode.get(sn) ?? sn)
				.filter(Boolean);
		} catch {}

		// Загружаем все графики для lookup по scheduleId
		const allSchedules = await db.select().from(schedule);
		const schedulesById: Record<number, { standardWorkTime: number; weekDays: string | null }> = {};
		for (const s of allSchedules) {
			schedulesById[s.id] = { standardWorkTime: s.standardWorkTime, weekDays: s.weekDays };
		}

		return {
			departments: Array.from(deptMap.values()),
			dayMarks,
			calendarDays: Object.fromEntries(
				Array.from(calendarDayMap.entries()).map(([k, v]) => [
					typeof k === 'object' && (k as any).toISOString
						? (k as Date).toISOString().split('T')[0]
						: String(k),
					v
				])
			),
			cellColorRules,
			markColorRules,
			shiftMarks: shiftMarkShortnames,
			schedulesById,
			year,
			month,
			lastDay
		};
	},

	updateDayMark: async (
		employeeId: number,
		date: string,
		shortName: string,
		updatedBy?: string | null,
		extraMarkCode?: string | null,
		extraMarkMinutes?: number | null
	) => {
		const trimmed = shortName.trim();

		// Конвертируем shortName в code, если передан shortName
		const allMarks = await db.select().from(dayMark);
		const codeByShort = new Map(allMarks.map((m) => [m.shortName, m.code]));
		const markCode = codeByShort.get(trimmed) ?? trimmed;

		const updateData: Record<string, any> = {
			updatedBy: updatedBy ?? null
		};
		if (!trimmed) {
			// Пустая строка — полностью очищаем день (метка и часы)
			updateData.dayMarkCode = null;
			updateData.reportWorkTime = null;
			updateData.reportNightWorkTime = null;
		} else {
			updateData.dayMarkCode = markCode;
		}
		if (extraMarkCode !== undefined) updateData.extraMarkCode = extraMarkCode ?? null;
		if (extraMarkMinutes !== undefined) updateData.extraMarkMinutes = extraMarkMinutes ?? null;

		const hoursMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(Я|Н)$/);

		if (hoursMatch) {
			const hours = parseFloat(hoursMatch[1]);
			const baseMark = hoursMatch[2];
			const baseCode = codeByShort.get(baseMark) ?? baseMark;
			const minutes = Math.round(hours * 60);
			updateData.dayMarkCode = baseCode;
			updateData.reportWorkTime = minutes;
			updateData.reportNightWorkTime = baseCode === 'N' ? minutes : 0;
		} else {
			const shiftMarks = await getShiftMarkShortnames();

			// Проверяем по shortName или по code (shiftMarks — shortName-ы)
			const isShiftMark =
				shiftMarks.has(trimmed) ||
				shiftMarks.has(allMarks.find((m) => m.code === trimmed)?.shortName ?? '');
			if (isShiftMark) {
				const empSchedule = await db
					.select({ standardWorkTime: schedule.standardWorkTime })
					.from(employeeSchedule)
					.innerJoin(schedule, eq(employeeSchedule.scheduleId, schedule.id))
					.where(eq(employeeSchedule.employeeId, employeeId))
					.limit(1)
					.then((r) => r[0]);

				if (empSchedule) {
					updateData.reportWorkTime = empSchedule.standardWorkTime;
					updateData.reportNightWorkTime = markCode === 'N' ? empSchedule.standardWorkTime : 0;
				}
			} else if (trimmed === '-') {
				updateData.reportWorkTime = null;
				updateData.reportNightWorkTime = null;
			}
		}

		const existing = await db
			.select({ id: worktimeTracker.id })
			.from(worktimeTracker)
			.where(and(eq(worktimeTracker.employeeId, employeeId), eq(worktimeTracker.date, date)))
			.limit(1)
			.then((r) => r[0]);

		let saved: typeof worktimeTracker.$inferSelect | undefined;

		if (existing) {
			const [row] = await db
				.update(worktimeTracker)
				.set(updateData)
				.where(eq(worktimeTracker.id, existing.id))
				.returning();
			saved = row;
		} else {
			const [row] = await db
				.insert(worktimeTracker)
				.values({ employeeId, date, ...updateData })
				.returning();
			saved = row;
		}

		return {
			employeeId: saved!.employeeId,
			date: saved!.date,
			reportWorkTime: saved!.reportWorkTime,
			reportNightWorkTime: saved!.reportNightWorkTime,
			dayMarkCode: saved!.dayMarkCode,
			extraMarkCode: saved!.extraMarkCode,
			extraMarkMinutes: saved!.extraMarkMinutes
		};
	},

	upsert: async (data: {
		employeeId: number;
		date: string;
		isNightShift?: boolean | null;
		dayMarkCode?: string | null;
		rawWorkTime?: number | null;
		rawNightWorkTime?: number | null;
		shiftWorkTime?: number | null;
		shiftNightWorkTime?: number | null;
		reportWorkTime?: number | null;
		reportNightWorkTime?: number | null;
		updatedBy?: string | null;
	}) => {
		const existing = await db
			.select({ id: worktimeTracker.id })
			.from(worktimeTracker)
			.where(
				and(eq(worktimeTracker.employeeId, data.employeeId), eq(worktimeTracker.date, data.date))
			)
			.limit(1)
			.then((r) => r[0]);

		if (existing) {
			const [updated] = await db
				.update(worktimeTracker)
				.set({
					isNightShift: data.isNightShift,
					dayMarkCode: data.dayMarkCode,
					rawWorkTime: data.rawWorkTime,
					rawNightWorkTime: data.rawNightWorkTime,
					shiftWorkTime: data.shiftWorkTime,
					shiftNightWorkTime: data.shiftNightWorkTime,
					reportWorkTime: data.reportWorkTime,
					reportNightWorkTime: data.reportNightWorkTime,
					updatedBy: data.updatedBy
				})
				.where(eq(worktimeTracker.id, existing.id))
				.returning();
			return updated;
		} else {
			const [inserted] = await db.insert(worktimeTracker).values(data).returning();
			return inserted;
		}
	},

	calculateNightMinutes: (enter: Date, exit: Date) => {
		const nightStart = new Date(enter);
		nightStart.setHours(22, 0, 0, 0);
		const nightEnd = new Date(exit);
		nightEnd.setHours(6, 0, 0, 0);
		if (exit <= enter) nightEnd.setDate(nightEnd.getDate() + 1);
		const overlapStart = enter > nightStart ? enter : nightStart;
		const overlapEnd = exit < nightEnd ? exit : nightEnd;
		if (overlapStart >= overlapEnd) return 0;
		return Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);
	}
};
