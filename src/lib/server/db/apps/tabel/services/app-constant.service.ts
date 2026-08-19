import { db } from '$lib/server/db';
import { appConstant } from '../tables/app-constant';
import { eq, inArray } from 'drizzle-orm';

export const appConstantService = {
	list: () => db.select().from(appConstant).orderBy(appConstant.key),

	/** Константы по списку ключей */
	listByKeys: (keys: string[]) =>
		db.select().from(appConstant).where(inArray(appConstant.key, keys)),

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
