import { pgTable, serial, text, integer, boolean } from 'drizzle-orm/pg-core';
import { calendarTemplate } from './calendar-template';

export const calendar = pgTable('calendar', {
	id: serial('id').primaryKey(),
	templateId: integer('template_id')
		.notNull()
		.references(() => calendarTemplate.id, { onDelete: 'restrict' }),
	year: integer('year').notNull(),
	name: text('name').notNull(),
	isDefault: boolean('is_default').notNull().default(false)
});
