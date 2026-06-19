import { db } from '$lib/server/db';
import { leaveDocument } from '../tables/leave-document';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export const leaveDocumentService = {
	list: () => db.select().from(leaveDocument).orderBy(desc(leaveDocument.dateStart)),

	getById: (id: number) =>
		db
			.select()
			.from(leaveDocument)
			.where(eq(leaveDocument.id, id))
			.then((r) => r[0]),

	getByEmployee: (employeeId: number) =>
		db
			.select()
			.from(leaveDocument)
			.where(eq(leaveDocument.employeeId, employeeId))
			.orderBy(desc(leaveDocument.dateStart)),

	getByPeriod: (employeeId: number, from: string, to: string) =>
		db
			.select()
			.from(leaveDocument)
			.where(
				and(
					eq(leaveDocument.employeeId, employeeId),
					lte(leaveDocument.dateStart, to),
					gte(leaveDocument.dateEnd, from)
				)
			)
			.orderBy(leaveDocument.dateStart),

	create: (data: {
		employeeId: number;
		dateStart: string;
		dateEnd: string;
		dayMarkId: number;
		docNumber?: string | null;
	}) =>
		db
			.insert(leaveDocument)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (
		id: number,
		data: {
			dateStart?: string;
			dateEnd?: string;
			dayMarkId?: number;
			docNumber?: string | null;
		}
	) =>
		db
			.update(leaveDocument)
			.set(data)
			.where(eq(leaveDocument.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(leaveDocument).where(eq(leaveDocument.id, id)),

	/** Проверить, есть ли у сотрудника активный отпуск на дату */
	isOnLeave: async (employeeId: number, date: string) => {
		const docs = await db
			.select()
			.from(leaveDocument)
			.where(
				and(
					eq(leaveDocument.employeeId, employeeId),
					lte(leaveDocument.dateStart, date),
					gte(leaveDocument.dateEnd, date)
				)
			)
			.limit(1);
		return docs.length > 0;
	}
};
