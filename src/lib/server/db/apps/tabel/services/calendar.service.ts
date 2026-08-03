import { db } from '$lib/server/db';
import { calendarTemplate } from '../tables/calendar-template';
import { calendar } from '../tables/calendar';
import { calendarDay } from '../tables/calendar-day';
import { calendarTemplateRule } from '../tables/calendar-template-rule';
import { schedule } from '../tables/schedule';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export const calendarService = {
	// --- Шаблоны ---
	listTemplates: () => db.select().from(calendarTemplate).orderBy(calendarTemplate.name),
	getTemplateById: (id: number) =>
		db
			.select()
			.from(calendarTemplate)
			.where(eq(calendarTemplate.id, id))
			.then((r) => r[0]),
	createTemplate: (data: {
		name: string;
		year: number;
		defaultWorkDays?: string | null;
		defaultWorkTime: number;
	}) =>
		db
			.insert(calendarTemplate)
			.values(data)
			.returning()
			.then((r) => r[0]),
	updateTemplate: (
		id: number,
		data: { name?: string; defaultWorkDays?: string; defaultWorkTime?: number }
	) =>
		db
			.update(calendarTemplate)
			.set(data)
			.where(eq(calendarTemplate.id, id))
			.returning()
			.then((r) => r[0]),
	removeTemplate: (id: number) => db.delete(calendarTemplate).where(eq(calendarTemplate.id, id)),

	// --- Правила шаблона ---
	getRules: (templateId: number) =>
		db
			.select()
			.from(calendarTemplateRule)
			.where(eq(calendarTemplateRule.templateId, templateId))
			.orderBy(calendarTemplateRule.month, calendarTemplateRule.day),
	createRule: (data: {
		templateId: number;
		month: number;
		day: number;
		autoTransfer?: boolean;
		preHoliday?: boolean;
		preScheduleId?: number | null;
	}) =>
		db
			.insert(calendarTemplateRule)
			.values(data)
			.returning()
			.then((r) => r[0]),

	/** Массовое создание правил */
	createRules: (data: {
		templateId: number;
		days: { month: number; day: number }[];
		autoTransfer?: boolean;
		preHoliday?: boolean;
		preScheduleId?: number | null;
	}) => {
		const {
			templateId,
			days,
			autoTransfer = false,
			preHoliday = false,
			preScheduleId = null
		} = data;
		const values = days.map((d) => ({
			templateId,
			month: d.month,
			day: d.day,
			autoTransfer,
			preHoliday,
			preScheduleId
		}));
		return values.length > 0
			? db.insert(calendarTemplateRule).values(values).onConflictDoNothing().returning()
			: Promise.resolve([]);
	},
	updateRule: (
		id: number,
		data: {
			month?: number;
			day?: number;
			autoTransfer?: boolean;
			preHoliday?: boolean;
			preScheduleId?: number | null;
		}
	) =>
		db
			.update(calendarTemplateRule)
			.set(data)
			.where(eq(calendarTemplateRule.id, id))
			.returning()
			.then((r) => r[0]),
	removeRule: (id: number) =>
		db.delete(calendarTemplateRule).where(eq(calendarTemplateRule.id, id)),

	// --- Календари (связка шаблон + год) ---
	listCalendars: () => db.select().from(calendar).orderBy(desc(calendar.year)),
	getCalendarById: (id: number) =>
		db
			.select()
			.from(calendar)
			.where(eq(calendar.id, id))
			.then((r) => r[0]),
	createCalendar: (data: { templateId: number; year: number; name: string }) =>
		db
			.insert(calendar)
			.values(data)
			.returning()
			.then((r) => r[0]),
	removeCalendar: (id: number) => db.delete(calendar).where(eq(calendar.id, id)),

	/** Установить календарь как основной для года (сбрасывает у остальных) */
	setDefaultCalendar: async (id: number) => {
		const cal = await db
			.select()
			.from(calendar)
			.where(eq(calendar.id, id))
			.then((r) => r[0]);
		if (!cal) return null;
		await db.update(calendar).set({ isDefault: false }).where(eq(calendar.year, cal.year));
		await db.update(calendar).set({ isDefault: true }).where(eq(calendar.id, id));
		return cal;
	},

	/** Получить основной календарь на год */
	getDefaultCalendar: (year: number) =>
		db
			.select()
			.from(calendar)
			.where(and(eq(calendar.year, year), eq(calendar.isDefault, true)))
			.then((r) => r[0]),

	// --- Генерация дней календаря ---
	generateYear: async (calendarId: number) => {
		const cal = await db
			.select()
			.from(calendar)
			.where(eq(calendar.id, calendarId))
			.then((r) => r[0]);
		if (!cal) throw new Error('Calendar not found');

		const tpl = await db
			.select()
			.from(calendarTemplate)
			.where(eq(calendarTemplate.id, cal.templateId))
			.then((r) => r[0]);
		if (!tpl) throw new Error('Template not found');

		const rules = await db
			.select()
			.from(calendarTemplateRule)
			.where(eq(calendarTemplateRule.templateId, cal.templateId));
		const schedules = await db.select().from(schedule);
		const defaultWorkDays: number[] = tpl.defaultWorkDays
			? JSON.parse(tpl.defaultWorkDays)
			: [1, 2, 3, 4, 5];
		const year = cal.year;
		const days: (typeof calendarDay.$inferInsert)[] = [];
		const usedDates = new Set<string>();

		for (let month = 1; month <= 12; month++) {
			const daysInMonth = new Date(year, month, 0).getDate();
			for (let day = 1; day <= daysInMonth; day++) {
				const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
				const dow = new Date(year, month - 1, day).getDay();
				const isWorkDay = defaultWorkDays.includes(dow === 0 ? 7 : dow);

				let dayType = isWorkDay ? 'workday' : 'weekend';
				let workTime = isWorkDay ? tpl.defaultWorkTime : 0;
				let scheduleId: number | null = null;
				let transferFrom: string | null = null;
				const rule = rules.find((r) => r.month === month && r.day === day);

				if (rule) {
					dayType = 'holiday';
					workTime = 0;

					if (rule.autoTransfer && (dow === 0 || dow === 6)) {
						let targetDay = day + 1;
						while (targetDay <= daysInMonth) {
							const tdow = new Date(year, month - 1, targetDay).getDay();
							// Ищем ближайший рабочий день для переноса
							if (defaultWorkDays.includes(tdow === 0 ? 7 : tdow)) {
								if (!rules.find((r) => r.month === month && r.day === targetDay)) {
									const td = `${year}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
									usedDates.add(td);
									days.push({
										calendarId,
										date: td,
										dayType: 'holiday',
										workTime: 0,
										transferFrom: date
									});
									break;
								}
							}
							targetDay++;
						}
					}

					if (rule.preHoliday && rule.preScheduleId && day > 1) {
						const prevDate = `${year}-${String(month).padStart(2, '0')}-${String(day - 1).padStart(2, '0')}`;
						const prevDow = new Date(year, month - 1, day - 1).getDay();
						if (prevDow !== 0 && prevDow !== 6) {
							const prevSched = schedules.find((s) => s.id === rule.preScheduleId);
							const existingIdx = days.findIndex((d) => d.date === prevDate);
							const entry = {
								calendarId,
								date: prevDate,
								dayType: 'preholiday' as const,
								workTime: prevSched?.standardWorkTime ?? tpl.defaultWorkTime,
								scheduleId: rule.preScheduleId,
								transferFrom: null as string | null
							};
							if (existingIdx >= 0) days[existingIdx] = entry;
							else days.push(entry);
						}
					}
				}

				if (usedDates.has(date)) continue;

				days.push({
					calendarId,
					date,
					dayType: dayType as any,
					workTime,
					scheduleId,
					transferFrom
				});
			}
		}

		await db.delete(calendarDay).where(eq(calendarDay.calendarId, calendarId));
		if (days.length > 0) await db.insert(calendarDay).values(days);
		return { total: days.length };
	},

	// --- Дни календаря ---
	getDays: (calendarId: number) =>
		db
			.select()
			.from(calendarDay)
			.where(eq(calendarDay.calendarId, calendarId))
			.orderBy(calendarDay.date),

	upsertDay: (data: {
		calendarId: number;
		date: string;
		dayType:
			| 'workday'
			| 'holiday'
			| 'preholiday'
			| 'weekend'
			| 'transferred_workday'
			| 'transferred_holiday';
		scheduleId?: number | null;
		workTime?: number | null;
		transferFrom?: string | null;
	}) =>
		db
			.insert(calendarDay)
			.values(data)
			.onConflictDoUpdate({
				target: [calendarDay.calendarId, calendarDay.date],
				set: {
					dayType: data.dayType,
					scheduleId: data.scheduleId,
					workTime: data.workTime,
					transferFrom: data.transferFrom
				}
			})
			.returning()
			.then((r) => r[0])
};
