import { db } from '$lib/server/db';
import { appConstant } from '../tables/app-constant';
import { eq, inArray } from 'drizzle-orm';
import { remember, invalidate } from '$lib/server/cache';

const TTL = 300;
const tag = (key: string) => `const:${key}`;

export const appConstantService = {
	list: () =>
		remember('constants:all', TTL, ['constants'], () =>
			db.select().from(appConstant).orderBy(appConstant.key)
		),

	/** Константы из списка ключей */
	listByKeys: (keys: string[]) =>
		db.select().from(appConstant).where(inArray(appConstant.key, keys)),

	getByKey: (key: string) =>
		remember(`const:${key}`, TTL, [tag(key)], () =>
			db
				.select()
				.from(appConstant)
				.where(eq(appConstant.key, key))
				.then((r) => r[0])
		),

	upsert: (key: string, value: string) =>
		db
			.insert(appConstant)
			.values({ key, value })
			.onConflictDoUpdate({ target: appConstant.key, set: { value } })
			.returning()
			.then((r) => {
				invalidate(tag(key), 'constants');
				return r[0];
			}),

	remove: (key: string) =>
		db
			.delete(appConstant)
			.where(eq(appConstant.key, key))
			.then((r) => {
				invalidate(tag(key), 'constants');
				return r;
			})
};
