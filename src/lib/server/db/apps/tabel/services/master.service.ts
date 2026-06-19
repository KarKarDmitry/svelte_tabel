import { db } from '$lib/server/db';
import { master } from '../tables/master';
import { eq, and, or, isNull, gte, desc } from 'drizzle-orm';

export const masterService = {
	list: () => db.select().from(master).orderBy(desc(master.dateFrom)),

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
