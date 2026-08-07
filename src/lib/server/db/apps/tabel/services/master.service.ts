import { db } from '$lib/server/db';
import { master } from '../tables/master';
import { department } from '../tables/department';
import { eq, and, or, isNull, gte, desc } from 'drizzle-orm';

export const masterService = {
	list: () => db.select().from(master).orderBy(desc(master.dateFrom)),

	/** Все назначения с названием подразделения (для админки) */
	listWithDepartments: () =>
		db
			.select({
				id: master.id,
				userId: master.userId,
				departmentId: master.departmentId,
				departmentName: department.name,
				dateFrom: master.dateFrom,
				dateTo: master.dateTo
			})
			.from(master)
			.leftJoin(department, eq(department.id, master.departmentId))
			.orderBy(desc(master.dateFrom)),

	/**
	 * Синхронизация активных назначений пользователя (в транзакции):
	 * добавляет недостающие, удаляет лишние из списка departmentIds.
	 */
	syncActiveDepartments: (userId: string, departmentIds: number[], dateFrom: string) =>
		db.transaction(async (tx) => {
			const existing = await tx
				.select()
				.from(master)
				.where(and(eq(master.userId, userId), isNull(master.dateTo)));

			const activeByDept = new Map(existing.map((m) => [m.departmentId, m.id]));

			for (const m of existing) {
				if (!departmentIds.includes(m.departmentId)) {
					await tx.delete(master).where(eq(master.id, m.id));
				}
			}
			for (const deptId of departmentIds) {
				if (!activeByDept.has(deptId)) {
					await tx.insert(master).values({ userId, departmentId: deptId, dateFrom });
				}
			}
		}),

	getById: (id: number) =>
		db
			.select()
			.from(master)
			.where(eq(master.id, id))
			.then((r) => r[0]),

	getByDepartment: (departmentId: number) =>
		db
			.select()
			.from(master)
			.where(eq(master.departmentId, departmentId))
			.orderBy(desc(master.dateFrom)),

	getActiveByUser: (userId: string) =>
		db
			.select()
			.from(master)
			.where(and(eq(master.userId, userId), isNull(master.dateTo))),

	getActiveByDepartment: (departmentId: number, date: string) =>
		db
			.select()
			.from(master)
			.where(
				and(
					eq(master.departmentId, departmentId),
					or(isNull(master.dateTo), gte(master.dateTo, date))
				)
			)
			.limit(1)
			.then((r) => r[0]),

	create: (data: {
		userId: string;
		departmentId: number;
		dateFrom?: string | null;
		dateTo?: string | null;
	}) =>
		db
			.insert(master)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (
		id: number,
		data: {
			userId?: string;
			departmentId?: number;
			dateFrom?: string | null;
			dateTo?: string | null;
		}
	) =>
		db
			.update(master)
			.set(data)
			.where(eq(master.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(master).where(eq(master.id, id))
};
