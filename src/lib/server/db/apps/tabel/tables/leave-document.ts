import { pgTable, serial, text, integer, date } from 'drizzle-orm/pg-core';
import { employee } from './employee';
import { dayMark } from './day-mark';

export const leaveDocument = pgTable('leave_document', {
	id: serial('id').primaryKey(),
	employeeId: integer('employee_id')
		.notNull()
		.references(() => employee.id, { onDelete: 'cascade' }),
	dateStart: date('date_start').notNull(),
	dateEnd: date('date_end').notNull(),
	dayMarkId: integer('day_mark_id')
		.notNull()
		.references(() => dayMark.id, { onDelete: 'restrict' }),
	docNumber: text('doc_number')
});
