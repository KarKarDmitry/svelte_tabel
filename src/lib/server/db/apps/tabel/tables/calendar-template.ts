import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export const calendarTemplate = pgTable('calendar_template', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	year: integer('year').notNull(),
	defaultWorkDays: text('default_work_days'),
	defaultWorkTime: integer('default_work_time').notNull()
});
