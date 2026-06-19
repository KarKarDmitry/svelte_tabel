import { pgTable, serial, text, integer, date } from 'drizzle-orm/pg-core';
import { documentType } from '../enums';
import { audit } from '../audit';
import { employee } from './employee';
import { department } from './department';
import { position } from './position';

export const hrDocument = pgTable('hr_document', {
	id: serial('id').primaryKey(),
	type: documentType('type').notNull(),
	date: date('date').notNull(),
	docNumber: text('doc_number'),
	employeeId: integer('employee_id')
		.notNull()
		.references(() => employee.id, { onDelete: 'cascade' }),
	departmentId: integer('department_id')
		.notNull()
		.references(() => department.id, { onDelete: 'restrict' }),
	positionId: integer('position_id')
		.notNull()
		.references(() => position.id, { onDelete: 'restrict' }),
	...audit
});
