import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const pass = pgTable('pass', {
	id: serial('id').primaryKey(),
	seria: text('seria'),
	number: text('number').notNull()
});
