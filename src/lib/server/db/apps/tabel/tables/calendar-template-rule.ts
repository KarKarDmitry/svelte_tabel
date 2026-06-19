import { pgTable, serial, text, integer, boolean } from 'drizzle-orm/pg-core';
import { calendarTemplate } from './calendar-template';
import { schedule } from './schedule';

export const calendarTemplateRule = pgTable('calendar_template_rule', {
	id: serial('id').primaryKey(),
	templateId: integer('template_id')
		.notNull()
		.references(() => calendarTemplate.id, { onDelete: 'cascade' }),
	month: integer('month').notNull(),
	day: integer('day').notNull(),
	autoTransfer: boolean('auto_transfer').notNull().default(false),
	preHoliday: boolean('pre_holiday').notNull().default(false),
	preScheduleId: integer('pre_schedule_id').references(() => schedule.id, {
		onDelete: 'set null'
	})
});
