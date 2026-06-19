import { pgTable, serial, text, integer, date, boolean, unique } from 'drizzle-orm/pg-core';
import { audit } from '../audit';
import { employee } from './employee';

export const worktimeTracker = pgTable(
	'worktime_tracker',
	{
		id: serial('id').primaryKey(),
		employeeId: integer('employee_id')
			.notNull()
			.references(() => employee.id, { onDelete: 'cascade' }),
		date: date('date').notNull(),
		isNightShift: boolean('is_night_shift'),
		dayMarkCode: text('day_mark_code'),
		extraMarkCode: text('extra_mark_code'),
		extraMarkMinutes: integer('extra_mark_minutes'),
		rawWorkTime: integer('raw_work_time'),
		rawNightWorkTime: integer('raw_night_work_time'),
		shiftWorkTime: integer('shift_work_time'),
		shiftNightWorkTime: integer('shift_night_work_time'),
		reportWorkTime: integer('report_work_time'),
		reportNightWorkTime: integer('report_night_work_time'),
		scheduleId: integer('schedule_id'),
		...audit
	},
	(table) => [unique().on(table.employeeId, table.date)]
);
