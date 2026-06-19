import { pgTable, serial, text, boolean } from 'drizzle-orm/pg-core';
import { dayMarkCategory } from '../enums';

export const dayMark = pgTable('day_mark', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	shortName: text('short_name').notNull().unique(),
	code: text('code').notNull().unique(),
	category: dayMarkCategory('category').notNull(),
	reportCode: text('report_code'),
	reportExclude: boolean('report_exclude').default(false).notNull()
});
