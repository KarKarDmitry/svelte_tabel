import { db } from '$lib/server/db';
import { remember, invalidate } from '$lib/server/cache';
import { schedule } from '../tables/schedule';
import { schedulePoint } from '../tables/schedule-point';
import { employeeSchedule } from '../tables/employee-schedule';
import { eq, and, isNull, inArray } from 'drizzle-orm';

export const scheduleService = {
	// --- Графики ---

	list: () =>
		remember('schedules:list', 300, ['schedules'], () =>
			db.select().from(schedule).orderBy(schedule.name)
		),

	getById: (id: number) =>
		db
			.select()
			.from(schedule)
			.where(eq(schedule.id, id))
			.then((r) => r[0]),

	create: (data: { name: string; standardWorkTime: number; weekDays?: string | null }) =>
		db
			.insert(schedule)
			.values(data)
			.returning()
			.then((r) => {
				invalidate('schedules');
				return r[0];
			}),

	update: (
		id: number,
		data: { name?: string; standardWorkTime?: number; weekDays?: string | null }
	) =>
		db
			.update(schedule)
			.set(data)
			.where(eq(schedule.id, id))
			.returning()
			.then((r) => {
				invalidate('schedules');
				return r[0];
			}),

	remove: (id: number) =>
		db
			.delete(schedule)
			.where(eq(schedule.id, id))
			.then((r) => {
				invalidate('schedules');
				return r;
			}),

	// --- Точки графиков ---

	getPoints: (scheduleId: number) =>
		db
			.select()
			.from(schedulePoint)
			.where(eq(schedulePoint.scheduleId, scheduleId))
			.orderBy(schedulePoint.time),

	createPoint: (data: {
		scheduleId: number;
		type: 'Entry' | 'Exit' | 'Break';
		time: string;
		endTime?: string | null;
		leftBound: number;
		rightBound: number;
	}) =>
		db
			.insert(schedulePoint)
			.values(data)
			.returning()
			.then((r) => r[0]),

	updatePoint: (
		id: number,
		data: {
			type?: 'Entry' | 'Exit' | 'Break';
			time?: string;
			endTime?: string | null;
			leftBound?: number;
			rightBound?: number;
		}
	) =>
		db
			.update(schedulePoint)
			.set(data)
			.where(eq(schedulePoint.id, id))
			.returning()
			.then((r) => r[0]),

	removePoint: (id: number) => db.delete(schedulePoint).where(eq(schedulePoint.id, id)),

	// --- Назначение графиков сотрудникам ---

	/** Получить все назначения графиков для списка сотрудников */
	listAssignmentsByEmployees: (employeeIds: number[]) =>
		db.select().from(employeeSchedule).where(inArray(employeeSchedule.employeeId, employeeIds)),

	/** Получить текущий график сотрудника */
	getCurrentByEmployee: (employeeId: number) =>
		db
			.select({ schedule, employeeSchedule })
			.from(employeeSchedule)
			.innerJoin(schedule, eq(schedule.id, employeeSchedule.scheduleId))
			.where(and(eq(employeeSchedule.employeeId, employeeId), isNull(employeeSchedule.dateTo)))
			.then((r) => r[0]),

	/** Получить все графики сотрудника (история) */
	getHistoryByEmployee: (employeeId: number) =>
		db
			.select({ schedule, employeeSchedule })
			.from(employeeSchedule)
			.innerJoin(schedule, eq(schedule.id, employeeSchedule.scheduleId))
			.where(eq(employeeSchedule.employeeId, employeeId))
			.orderBy(employeeSchedule.dateFrom),

	/** Получить назначение графика по ID (для проверок) */
	getEmployeeScheduleById: (id: number) =>
		db
			.select()
			.from(employeeSchedule)
			.where(eq(employeeSchedule.id, id))
			.then((r) => r[0]),

	/** Назначить график сотруднику */
	assignToEmployee: (data: { employeeId: number; scheduleId: number; dateFrom: string }) =>
		db
			.insert(employeeSchedule)
			.values(data)
			.returning()
			.then((r) => r[0]),

	/** Обновить назначение графика (график и/или даты начала/окончания) */
	updateEmployeeSchedule: (
		id: number,
		data: { scheduleId?: number; dateFrom?: string; dateTo?: string | null }
	) =>
		db
			.update(employeeSchedule)
			.set(data)
			.where(eq(employeeSchedule.id, id))
			.returning()
			.then((r) => r[0]),

	/** Открепить график — закрыть период, не удаляя запись (остаётся в истории) */
	unassignFromEmployee: (id: number, dateTo: string) =>
		db
			.update(employeeSchedule)
			.set({ dateTo })
			.where(eq(employeeSchedule.id, id))
			.returning()
			.then((r) => r[0]),

	removeEmployeeSchedule: (id: number) =>
		db.delete(employeeSchedule).where(eq(employeeSchedule.id, id)),
	closeCurrentSchedule: (employeeId: number, dateTo: string) =>
		db
			.update(employeeSchedule)
			.set({ dateTo })
			.where(and(eq(employeeSchedule.employeeId, employeeId), isNull(employeeSchedule.dateTo))),

	/** Получить полный график со всеми точками */
	getWithPoints: async (id: number) => {
		const s = await db
			.select()
			.from(schedule)
			.where(eq(schedule.id, id))
			.then((r) => r[0]);
		if (!s) return undefined;
		const points = await db
			.select()
			.from(schedulePoint)
			.where(eq(schedulePoint.scheduleId, id))
			.orderBy(schedulePoint.time);
		return { ...s, points };
	}
};
