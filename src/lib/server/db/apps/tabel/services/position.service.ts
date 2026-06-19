import { db } from '$lib/server/db';
import { position } from '../tables/position';
import { eq } from 'drizzle-orm';

export const positionService = {
	list: () => db.select().from(position).orderBy(position.name),

	getById: (id: number) =>
		db
			.select()
			.from(position)
			.where(eq(position.id, id))
			.then((r) => r[0]),

	create: (data: { name: string }) =>
		db
			.insert(position)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (id: number, data: { name: string }) =>
		db
			.update(position)
			.set(data)
			.where(eq(position.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(position).where(eq(position.id, id))
};
