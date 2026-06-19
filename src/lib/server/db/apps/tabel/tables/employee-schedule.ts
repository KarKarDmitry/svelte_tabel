import { pgTable, serial, integer, date } from 'drizzle-orm/pg-core';
import { employee } from './employee';
import { schedule } from './schedule';

export const employeeSchedule = pgTable('employee_schedule', {
	id: serial('id').primaryKey(),
	employeeId: integer('employee_id')
		.notNull()
		.references(() => employee.id, { onDelete: 'cascade' }),
	scheduleId: integer('schedule_id')
		.notNull()
		.references(() => schedule.id, { onDelete: 'cascade' }),
	dateFrom: date('date_from'),
	dateTo: date('date_to')
});
