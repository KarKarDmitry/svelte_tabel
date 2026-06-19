import { db } from '$lib/server/db';
import { turnstileEventTracker } from '../tables/turnstile-event-tracker';
import { turnstileEvent } from '../tables/turnstile-event';
import { employee } from '../tables/employee';
import { eq, and, between, desc, like, or, asc, count, sql, gte, lte, ilike } from 'drizzle-orm';

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

	/** Очистить события за период */
	removeByPeriod: (from: Date, to: Date) =>
		db.delete(turnstileEventTracker).where(between(turnstileEventTracker.datetime, from, to)),

	/** Поиск с пагинацией */
	searchWithFilters: async (params: {
		search?: string;
		eventId?: number | null;
		dateFrom?: string | null;
		dateTo?: string | null;
		page: number;
		pageSize: number;
	}) => {
		const { search, eventId, dateFrom, dateTo, page, pageSize } = params;
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
