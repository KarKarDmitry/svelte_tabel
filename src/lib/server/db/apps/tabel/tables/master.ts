import { pgTable, serial, text, integer, date } from 'drizzle-orm/pg-core';
import { user } from '$lib/server/db/auth.schema';
import { department } from './department';

export const master = pgTable('master', {
	id: serial('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	departmentId: integer('department_id')
		.notNull()
		.references(() => department.id, { onDelete: 'cascade' }),
	dateFrom: date('date_from'),
	dateTo: date('date_to')
});
