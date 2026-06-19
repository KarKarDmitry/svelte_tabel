import { pgTable, serial, integer, date } from 'drizzle-orm/pg-core';
import { employee } from './employee';
import { pass } from './pass';

export const employeePass = pgTable('employee_pass', {
	id: serial('id').primaryKey(),
	employeeId: integer('employee_id')
		.notNull()
		.references(() => employee.id, { onDelete: 'cascade' }),
	passId: integer('pass_id')
		.notNull()
		.references(() => pass.id, { onDelete: 'cascade' }),
	dateFrom: date('date_from'),
	dateTo: date('date_to')
});
