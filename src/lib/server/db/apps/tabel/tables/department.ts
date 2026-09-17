import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export const department = pgTable('department', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	pp: integer('pp').default(1000)
});
