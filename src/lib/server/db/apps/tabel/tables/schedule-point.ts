import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';
import { schedulePointType } from '../enums';
import { schedule } from './schedule';

export const schedulePoint = pgTable('schedule_point', {
	id: serial('id').primaryKey(),
	scheduleId: integer('schedule_id')
		.notNull()
		.references(() => schedule.id, { onDelete: 'cascade' }),
	type: schedulePointType('type').notNull(),
	time: text('time').notNull(),
	endTime: text('end_time'),
	leftBound: integer('left_bound').notNull(),
	rightBound: integer('right_bound').notNull()
});
