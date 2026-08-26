import { db } from '$lib/server/db';
import { dayMark } from '../tables/day-mark';
import { eq } from 'drizzle-orm';
import { remember, invalidate } from '$lib/server/cache';

type Category = 'work' | 'paid_absence' | 'unpaid_absence' | 'violation' | 'day_off';

export const dayMarkService = {
	list: () =>
		remember('daymarks', 300, ['day-marks'], () => db.select().from(dayMark).orderBy(dayMark.name)),

	getById: (id: number) =>
		db
			.select()
			.from(dayMark)
			.where(eq(dayMark.id, id))
			.then((r) => r[0]),

	getByCode: (code: string) =>
		db
			.select()
			.from(dayMark)
			.where(eq(dayMark.code, code))
			.then((r) => r[0]),

	create: (data: {
		name: string;
		shortName: string;
		code: string;
		category: Category;
		reportCode?: string | null;
		reportExclude?: boolean;
	}) =>
		db
			.insert(dayMark)
			.values(data)
			.returning()
			.then((r) => {
				invalidate('day-marks');
				return r[0];
			}),

	update: (
		id: number,
		data: {
			name?: string;
			shortName?: string;
			code?: string;
			category?: Category;
			reportCode?: string | null;
			reportExclude?: boolean;
		}
	) =>
		db
			.update(dayMark)
			.set(data)
			.where(eq(dayMark.id, id))
			.returning()
			.then((r) => {
				invalidate('day-marks');
				return r[0];
			}),

	remove: (id: number) =>
		db
			.delete(dayMark)
			.where(eq(dayMark.id, id))
			.then((r) => {
				invalidate('day-marks');
				return r;
			}),

	workMarks: () => db.select().from(dayMark).where(eq(dayMark.category, 'work'))
};
