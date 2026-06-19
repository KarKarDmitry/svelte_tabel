import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

export const employee = pgTable('employee', {
	id: serial('id').primaryKey(),
	number: text('number').notNull().unique(),
	lastName: text('last_name').notNull(),
	firstName: text('first_name').notNull(),
	middleName: text('middle_name')
});
