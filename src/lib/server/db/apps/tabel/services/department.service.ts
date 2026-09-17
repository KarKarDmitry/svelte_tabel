import { db } from '$lib/server/db';
import { department } from '../tables/department';
import { eq, asc } from 'drizzle-orm';

export const departmentService = {
	list: () => db.select().from(department).orderBy(asc(department.pp), asc(department.name)),

	getById: (id: number) =>
		db
			.select()
			.from(department)
			.where(eq(department.id, id))
			.then((r) => r[0]),

	create: (data: { name: string; pp?: number }) =>
		db
			.insert(department)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (id: number, data: { name: string; pp?: number }) =>
		db
			.update(department)
			.set(data)
			.where(eq(department.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(department).where(eq(department.id, id))
};
