import { db } from '$lib/server/db';
import { hrDocument } from '../tables/document';
import { eq, and, desc, lte, inArray } from 'drizzle-orm';

export const documentService = {
	list: () => db.select().from(hrDocument).orderBy(desc(hrDocument.date)),

	getById: (id: number) =>
		db
			.select()
			.from(hrDocument)
			.where(eq(hrDocument.id, id))
			.then((r) => r[0]),

	getByEmployee: (employeeId: number) =>
		db
			.select()
			.from(hrDocument)
			.where(eq(hrDocument.employeeId, employeeId))
			.orderBy(desc(hrDocument.date)),

	create: (data: {
		type: 'hiring' | 'dismissal' | 'transfer';
		date: string;
		docNumber?: string | null;
		employeeId: number;
		departmentId: number;
		positionId: number;
		updatedBy?: string | null;
	}) =>
		db
			.insert(hrDocument)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (
		id: number,
		data: {
			type?: 'hiring' | 'dismissal' | 'transfer';
			date?: string;
			docNumber?: string | null;
			departmentId?: number;
			positionId?: number;
			updatedBy?: string | null;
		}
	) =>
		db
			.update(hrDocument)
			.set(data)
			.where(eq(hrDocument.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(hrDocument).where(eq(hrDocument.id, id)),

	/** Последний действующий документ сотрудника на дату */
	getActiveAtDate: (employeeId: number, date: string) =>
		db
			.select()
			.from(hrDocument)
			.where(and(eq(hrDocument.employeeId, employeeId), lte(hrDocument.date, date)))
			.orderBy(desc(hrDocument.date))
			.limit(1)
			.then((r) => r[0]),

	/** Статусы сотрудников по последнему hr_document (для badge): один запрос на множество id */
	getLastStatusByEmployeeIds: async (ids: number[]) => {
		const out = new Map<number, string>();
		if (ids.length === 0) return out;
		const lastDocs = await db
			.select({
				employeeId: hrDocument.employeeId,
				type: hrDocument.type,
				date: hrDocument.date
			})
			.from(hrDocument)
			.where(inArray(hrDocument.employeeId, ids))
			.orderBy(desc(hrDocument.date));
		for (const d of lastDocs) {
			if (!out.has(d.employeeId)) {
				out.set(d.employeeId, d.type === 'dismissal' ? 'dismissed' : 'active');
			}
		}
		return out;
	}
};
