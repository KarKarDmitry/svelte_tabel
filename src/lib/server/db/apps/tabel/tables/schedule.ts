import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export const schedule = pgTable('schedule', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	standardWorkTime: integer('standard_work_time').notNull(),
	weekDays: text('week_days')
});
