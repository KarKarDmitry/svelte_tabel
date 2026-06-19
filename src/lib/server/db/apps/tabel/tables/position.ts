import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const position = pgTable('position', {
	id: serial('id').primaryKey(),
	name: text('name').notNull()
});
