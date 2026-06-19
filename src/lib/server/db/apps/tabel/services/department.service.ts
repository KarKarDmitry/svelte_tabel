import { db } from '$lib/server/db';
import { department } from '../tables/department';
import { eq } from 'drizzle-orm';

export const departmentService = {
	list: () => db.select().from(department).orderBy(department.name),

	getById: (id: number) =>
		db
			.select()
			.from(department)
			.where(eq(department.id, id))
			.then((r) => r[0]),

	create: (data: { name: string }) =>
		db
			.insert(department)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (id: number, data: { name: string }) =>
		db
			.update(department)
			.set(data)
			.where(eq(department.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(department).where(eq(department.id, id))
};
