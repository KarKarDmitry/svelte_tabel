import { pgEnum } from 'drizzle-orm/pg-core';

export const documentType = pgEnum('document_type', ['hiring', 'dismissal', 'transfer']);

export const dayMarkCategory = pgEnum('day_mark_category', [
	'work',
	'paid_absence',
	'unpaid_absence',
	'violation',
	'day_off'
]);

export const schedulePointType = pgEnum('schedule_point_type', ['Entry', 'Exit', 'Break']);

export const calendarDayType = pgEnum('calendar_day_type', [
	'workday',
	'holiday',
	'preholiday',
	'weekend',
	'transferred_workday',
	'transferred_holiday'
]);
