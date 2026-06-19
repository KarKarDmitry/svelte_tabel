import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const turnstileEvent = pgTable('turnstile_event', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique(),
	direction: text('direction')
});
