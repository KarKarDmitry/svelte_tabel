import { pgTable, serial, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { employee } from './employee';
import { pass } from './pass';
import { turnstileEvent } from './turnstile-event';

export const turnstileEventTracker = pgTable(
	'turnstile_event_tracker',
	{
		id: serial('id').primaryKey(),
		employeeId: integer('employee_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		passId: integer('pass_id')
			.notNull()
			.references(() => pass.id, { onDelete: 'restrict' }),
		datetime: timestamp('datetime', { withTimezone: true }).notNull(),
		eventId: integer('event_id')
			.notNull()
			.references(() => turnstileEvent.id, { onDelete: 'restrict' })
	},
	(table) => ({
		uniqueEvent: unique('uq_turnstile_event').on(table.employeeId, table.datetime, table.eventId)
	})
);
