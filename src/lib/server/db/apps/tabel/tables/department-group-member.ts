import { pgTable, serial, integer, unique } from 'drizzle-orm/pg-core';
import { departmentGroup } from './department-group';
import { department } from './department';

export const departmentGroupMember = pgTable(
	'department_group_member',
	{
		id: serial('id').primaryKey(),
		groupId: integer('group_id')
			.notNull()
			.references(() => departmentGroup.id, { onDelete: 'cascade' }),
		departmentId: integer('department_id')
			.notNull()
			.references(() => department.id, { onDelete: 'cascade' })
	},
	(table) => [unique().on(table.groupId, table.departmentId)]
);
