import { relations } from 'drizzle-orm';

// --- department
import { department } from './tables/department';
import { position } from './tables/position';
import { dayMark } from './tables/day-mark';
import { schedule } from './tables/schedule';
import { employee } from './tables/employee';
import { master } from './tables/master';
import { schedulePoint } from './tables/schedule-point';
import { employeeSchedule } from './tables/employee-schedule';
import { employeePass } from './tables/employee-pass';
import { calendar } from './tables/calendar';
import { calendarTemplate } from './tables/calendar-template';
import { calendarDay } from './tables/calendar-day';
import { calendarTemplateRule } from './tables/calendar-template-rule';
import { hrDocument } from './tables/document';
import { leaveDocument } from './tables/leave-document';
import { turnstileEvent } from './tables/turnstile-event';
import { turnstileEventTracker } from './tables/turnstile-event-tracker';
import { worktimeTracker } from './tables/worktime-tracker';
import { pass } from './tables/pass';

export const departmentRelations = relations(department, ({ many }) => ({
	masters: many(master),
	hrDocuments: many(hrDocument)
}));

export const positionRelations = relations(position, ({ many }) => ({
	hrDocuments: many(hrDocument)
}));

export const dayMarkRelations = relations(dayMark, ({ many }) => ({
	leaveDocuments: many(leaveDocument)
}));

export const scheduleRelations = relations(schedule, ({ many }) => ({
	points: many(schedulePoint),
	employeeSchedules: many(employeeSchedule),
	calendarDays: many(calendarDay)
}));

export const employeeRelations = relations(employee, ({ many }) => ({
	employeeSchedules: many(employeeSchedule),
	employeePass: many(employeePass),
	hrDocuments: many(hrDocument),
	leaveDocuments: many(leaveDocument),
	turnstileEventTrackers: many(turnstileEventTracker),
	worktimeTrackers: many(worktimeTracker)
}));

export const masterRelations = relations(master, ({ one }) => ({
	department: one(department, {
		fields: [master.departmentId],
		references: [department.id]
	})
}));

export const schedulePointRelations = relations(schedulePoint, ({ one }) => ({
	schedule: one(schedule, {
		fields: [schedulePoint.scheduleId],
		references: [schedule.id]
	})
}));

export const employeeScheduleRelations = relations(employeeSchedule, ({ one }) => ({
	employee: one(employee, {
		fields: [employeeSchedule.employeeId],
		references: [employee.id]
	}),
	schedule: one(schedule, {
		fields: [employeeSchedule.scheduleId],
		references: [schedule.id]
	})
}));

export const employeePassRelations = relations(employeePass, ({ one }) => ({
	employee: one(employee, {
		fields: [employeePass.employeeId],
		references: [employee.id]
	}),
	pass: one(pass, {
		fields: [employeePass.passId],
		references: [pass.id]
	})
}));

export const calendarTemplateRelations = relations(calendarTemplate, ({ many }) => ({
	calendars: many(calendar),
	rules: many(calendarTemplateRule)
}));

export const calendarTemplateRuleRelations = relations(calendarTemplateRule, ({ one }) => ({
	template: one(calendarTemplate, {
		fields: [calendarTemplateRule.templateId],
		references: [calendarTemplate.id]
	}),
	preSchedule: one(schedule, {
		fields: [calendarTemplateRule.preScheduleId],
		references: [schedule.id]
	})
}));

export const calendarRelations = relations(calendar, ({ one, many }) => ({
	template: one(calendarTemplate, {
		fields: [calendar.templateId],
		references: [calendarTemplate.id]
	}),
	days: many(calendarDay)
}));

export const calendarDayRelations = relations(calendarDay, ({ one }) => ({
	cal: one(calendar, {
		fields: [calendarDay.calendarId],
		references: [calendar.id]
	}),
	schedule: one(schedule, {
		fields: [calendarDay.scheduleId],
		references: [schedule.id]
	})
}));

export const hrDocumentRelations = relations(hrDocument, ({ one }) => ({
	employee: one(employee, {
		fields: [hrDocument.employeeId],
		references: [employee.id]
	}),
	department: one(department, {
		fields: [hrDocument.departmentId],
		references: [department.id]
	}),
	position: one(position, {
		fields: [hrDocument.positionId],
		references: [position.id]
	})
}));

export const leaveDocumentRelations = relations(leaveDocument, ({ one }) => ({
	employee: one(employee, {
		fields: [leaveDocument.employeeId],
		references: [employee.id]
	}),
	dayMark: one(dayMark, {
		fields: [leaveDocument.dayMarkId],
		references: [dayMark.id]
	})
}));

export const turnstileEventRelations = relations(turnstileEvent, ({ many }) => ({
	trackers: many(turnstileEventTracker)
}));

export const turnstileEventTrackerRelations = relations(turnstileEventTracker, ({ one }) => ({
	employee: one(employee, {
		fields: [turnstileEventTracker.employeeId],
		references: [employee.id]
	}),
	pass: one(pass, {
		fields: [turnstileEventTracker.passId],
		references: [pass.id]
	}),
	event: one(turnstileEvent, {
		fields: [turnstileEventTracker.eventId],
		references: [turnstileEvent.id]
	})
}));

export const worktimeTrackerRelations = relations(worktimeTracker, ({ one }) => ({
	employee: one(employee, {
		fields: [worktimeTracker.employeeId],
		references: [employee.id]
	})
}));

export const passRelations = relations(pass, ({ many }) => ({
	employeePass: many(employeePass),
	turnstileEventTrackers: many(turnstileEventTracker)
}));
