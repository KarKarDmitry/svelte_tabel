import { db } from '$lib/server/db';
import { turnstileEventTracker } from '../tables/turnstile-event-tracker';
import { turnstileEvent } from '../tables/turnstile-event';
import { pass } from '../tables/pass';
import { employee } from '../tables/employee';
import { hrDocument } from '../tables/document';
import {
	eq,
	and,
	between,
	desc,
	like,
	or,
	asc,
	count,
	sql,
	gte,
	lte,
	ilike,
	inArray
} from 'drizzle-orm';

export const turnstileEventTrackerService = {
	list: () => db.select().from(turnstileEventTracker).orderBy(desc(turnstileEventTracker.datetime)),

	getByEmployee: (employeeId: number) =>
		db
			.select()
			.from(turnstileEventTracker)
			.where(eq(turnstileEventTracker.employeeId, employeeId))
			.orderBy(turnstileEventTracker.datetime),

	getByPeriod: (employeeId: number, from: Date, to: Date) =>
		db
			.select()
			.from(turnstileEventTracker)
			.where(
				and(
					eq(turnstileEventTracker.employeeId, employeeId),
					between(turnstileEventTracker.datetime, from, to)
				)
			)
			.orderBy(turnstileEventTracker.datetime),

	bulkCreate: (data: { employeeId: number; passId: number; datetime: Date; eventId: number }[]) =>
		db.insert(turnstileEventTracker).values(data),

	remove: (id: number) => db.delete(turnstileEventTracker).where(eq(turnstileEventTracker.id, id)),

	/** События за период с деталями (название события, номер пропуска) */
	getByPeriodWithDetails: (employeeId: number, from: Date, to: Date) =>
		db
			.select({
				id: turnstileEventTracker.id,
				datetime: turnstileEventTracker.datetime,
				eventId: turnstileEventTracker.eventId,
				passId: turnstileEventTracker.passId,
				eventName: turnstileEvent.name,
				passSeria: pass.seria,
				passNumber: pass.number
			})
			.from(turnstileEventTracker)
			.innerJoin(turnstileEvent, eq(turnstileEvent.id, turnstileEventTracker.eventId))
			.leftJoin(pass, eq(pass.id, turnstileEventTracker.passId))
			.where(
				and(
					eq(turnstileEventTracker.employeeId, employeeId),
					between(turnstileEventTracker.datetime, from, to)
				)
			)
			.orderBy(turnstileEventTracker.datetime),

	/** Очистить события за период */
	removeByPeriod: (from: Date, to: Date) =>
		db.delete(turnstileEventTracker).where(between(turnstileEventTracker.datetime, from, to)),

	/** Поиск с пагинацией */
	searchWithFilters: async (params: {
		search?: string;
		eventId?: number | null;
		dateFrom?: string | null;
		dateTo?: string | null;
		/** null — без ограничения по отделам (admin); массив — только эти отделы */
		departmentIds?: number[] | null;
		page: number;
		pageSize: number;
	}) => {
		const { search, eventId, dateFrom, dateTo, departmentIds, page, pageSize } = params;
		const offset = (page - 1) * pageSize;

		const conds: any[] = [];
		if (search) {
			conds.push(
				or(
					ilike(employee.lastName, `%${search}%`),
					ilike(employee.firstName, `%${search}%`),
					ilike(sql`CAST(${employee.number} AS TEXT)`, `%${search}%`)
				)
			);
		}
		if (departmentIds) {
			// Сотрудник относится к подразделению, если его последний кадровый
			// документ (по дате) — по этому подразделению (вкл. уволенных)
			conds.push(
				sql`${employee.id} IN (
					SELECT d.employee_id FROM ${hrDocument} d
					WHERE ${inArray(sql`d.department_id`, departmentIds)}
					AND NOT EXISTS (
						SELECT 1 FROM ${hrDocument} d2
						WHERE d2.employee_id = d.employee_id AND d2.date > d.date
					)
				)`
			);
		}
		if (eventId) {
			conds.push(eq(turnstileEventTracker.eventId, eventId));
		}
		if (dateFrom) {
			conds.push(gte(turnstileEventTracker.datetime, new Date(dateFrom)));
		}
		if (dateTo) {
			const to = new Date(dateTo);
			to.setHours(23, 59, 59, 999);
			conds.push(lte(turnstileEventTracker.datetime, to));
		}

		const whereCond = conds.length > 0 ? and(...conds) : undefined;

		const rows = await db
			.select({
				id: turnstileEventTracker.id,
				datetime: turnstileEventTracker.datetime,
				eventName: turnstileEvent.name,
				employeeId: employee.id,
				employeeNumber: employee.number,
				lastName: employee.lastName,
				firstName: employee.firstName
			})
			.from(turnstileEventTracker)
			.innerJoin(employee, eq(employee.id, turnstileEventTracker.employeeId))
			.innerJoin(turnstileEvent, eq(turnstileEvent.id, turnstileEventTracker.eventId))
			.where(whereCond)
			.orderBy(desc(turnstileEventTracker.datetime))
			.limit(pageSize)
			.offset(offset);

		const total = await db
			.select({ cnt: count() })
			.from(turnstileEventTracker)
			.innerJoin(employee, eq(employee.id, turnstileEventTracker.employeeId))
			.innerJoin(turnstileEvent, eq(turnstileEvent.id, turnstileEventTracker.eventId))
			.where(whereCond)
			.then((r) => Number(r[0]?.cnt || 0));

		return {
			events: rows.map((r) => ({
				...r,
				fullName: `${r.lastName} ${r.firstName}`
			})),
			total,
			totalPages: Math.ceil(total / pageSize),
			page
		};
	}
};
