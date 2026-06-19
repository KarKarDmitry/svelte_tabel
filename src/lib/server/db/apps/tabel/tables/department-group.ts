import { pgTable, serial, text, integer, unique } from 'drizzle-orm/pg-core';

export const departmentGroup = pgTable('department_group', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique(),
	sortOrder: integer('sort_order').default(0).notNull()
});
