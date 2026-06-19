import { pgTable, serial, text, integer, date, unique } from 'drizzle-orm/pg-core';
import { calendarDayType } from '../enums';
import { calendar } from './calendar';
import { schedule } from './schedule';

export const calendarDay = pgTable(
	'calendar_day',
	{
		id: serial('id').primaryKey(),
		calendarId: integer('calendar_id')
			.notNull()
			.references(() => calendar.id, { onDelete: 'cascade' }),
		date: date('date').notNull(),
		dayType: calendarDayType('day_type').notNull(),
		scheduleId: integer('schedule_id').references(() => schedule.id, {
			onDelete: 'set null'
		}),
		workTime: integer('work_time'),
		transferFrom: date('transfer_from')
	},
	(table) => [unique().on(table.calendarId, table.date)]
);
