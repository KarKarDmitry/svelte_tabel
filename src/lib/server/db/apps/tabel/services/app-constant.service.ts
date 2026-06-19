import { db } from '$lib/server/db';
import { appConstant } from '../tables/app-constant';
import { eq } from 'drizzle-orm';

export const appConstantService = {
	list: () => db.select().from(appConstant).orderBy(appConstant.key),

	getByKey: (key: string) =>
		db
			.select()
			.from(appConstant)
			.where(eq(appConstant.key, key))
			.then((r) => r[0]),

	upsert: (key: string, value: string) =>
		db
			.insert(appConstant)
			.values({ key, value })
			.onConflictDoUpdate({ target: appConstant.key, set: { value } })
			.returning()
			.then((r) => r[0]),

	remove: (key: string) => db.delete(appConstant).where(eq(appConstant.key, key))
};
