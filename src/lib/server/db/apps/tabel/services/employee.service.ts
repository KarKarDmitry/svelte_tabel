import { db } from '$lib/server/db';
import { employee } from '../tables/employee';
import { department } from '../tables/department';
import { position } from '../tables/position';
import { hrDocument } from '../tables/document';
import { eq, and, desc, lte, sql, type SQL } from 'drizzle-orm';

export const employeeService = {
	list: () => db.select().from(employee).orderBy(employee.lastName, employee.firstName),

	getById: (id: number) =>
		db
			.select()
			.from(employee)
			.where(eq(employee.id, id))
			.then((r) => r[0]),

	getByNumber: (number: string) =>
		db
			.select()
			.from(employee)
			.where(eq(employee.number, number))
			.then((r) => r[0]),

	search: (query: string) =>
		db
			.select()
			.from(employee)
			.where(
				sql`${employee.lastName} ILIKE ${'%' + query + '%'}
					OR ${employee.firstName} ILIKE ${'%' + query + '%'}
					OR ${employee.number}::text ILIKE ${'%' + query + '%'}`
			)
			.orderBy(employee.lastName),

	/** Все сотрудники для сопоставления по ФИО в памяти (поля поиска кандидатов) */
	getAllForMatching: () =>
		db
			.select({
				id: employee.id,
				number: employee.number,
				lastName: employee.lastName,
				firstName: employee.firstName,
				middleName: employee.middleName
			})
			.from(employee),

	create: (data: {
		number: string;
		lastName: string;
		firstName: string;
		middleName?: string | null;
	}) =>
		db
			.insert(employee)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (
		id: number,
		data: { number?: string; lastName?: string; firstName?: string; middleName?: string | null }
	) =>
		db
			.update(employee)
			.set(data)
			.where(eq(employee.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(employee).where(eq(employee.id, id)),

	/** Сотрудники, которые сейчас работают в подразделении */
	getByDepartment: async (departmentId: number) => {
		const allDocs = await db
			.select()
			.from(hrDocument)
			.where(eq(hrDocument.departmentId, departmentId))
			.orderBy(desc(hrDocument.date));

		const employeeIds = new Set<number>();
		const dismissed = new Set<number>();

		for (const doc of allDocs) {
			if (doc.type === 'dismissal') {
				dismissed.add(doc.employeeId);
			} else if (doc.type === 'hiring') {
				if (!dismissed.has(doc.employeeId)) {
					employeeIds.add(doc.employeeId);
				}
			} else if (doc.type === 'transfer') {
				dismissed.add(doc.employeeId);
			}
		}

		if (employeeIds.size === 0) return [];

		return db
			.select()
			.from(employee)
			.where(sql`${employee.id} = ANY(${[...employeeIds]})`)
			.orderBy(employee.lastName);
	},

	/** Получить отдел сотрудника на указанную дату */
	getDepartmentAtDate: async (employeeId: number, date: string) => {
		const docs = await db
			.select()
			.from(hrDocument)
			.where(and(eq(hrDocument.employeeId, employeeId), lte(hrDocument.date, date)))
			.orderBy(desc(hrDocument.date))
			.limit(1);

		if (docs.length === 0) return undefined;
		const doc = docs[0];
		if (doc.type === 'dismissal') return undefined;

		const dep = await db
			.select()
			.from(department)
			.where(eq(department.id, doc.departmentId))
			.then((r) => r[0]);

		return dep;
	},

	/** Отдел сотрудника на каждый запрошенный день (батчем, один запрос) */
	getDepartmentsAtDates: async (rows: Array<{ employeeId: number; date: string }>) => {
		const out = new Map<string, number | null>();
		if (rows.length === 0) return out;

		const maxDate = rows.reduce((m, r) => (r.date > m ? r.date : m), rows[0].date);
		const ids = [...new Set(rows.map((r) => r.employeeId))];

		const docs = await db
			.select()
			.from(hrDocument)
			.where(and(sql`${hrDocument.employeeId} = ANY(${ids})`, lte(hrDocument.date, maxDate)))
			.orderBy(desc(hrDocument.date));

		const byEmp = new Map<number, (typeof hrDocument.$inferSelect)[]>();
		for (const d of docs) {
			if (!byEmp.has(d.employeeId)) byEmp.set(d.employeeId, []);
			byEmp.get(d.employeeId)!.push(d);
		}

		for (const { employeeId, date } of rows) {
			// docs отсортированы по дате desc → первый подходящий = последний документ на дату
			const last = (byEmp.get(employeeId) ?? []).find((d) => d.date <= date);
			const dept = last && last.type !== 'dismissal' ? last.departmentId : null;
			out.set(`${employeeId}-${date}`, dept);
		}
		return out;
	},

	/** Поиск с фильтрацией, сортировкой и пагинацией */
	searchWithFilters: async (params: {
		search?: string;
		department?: string;
		position?: string;
		status?: string;
		/** null — без ограничения по отделам (admin); массив — только эти отделы */
		departmentIds?: number[] | null;
		page: number;
		pageSize: number;
		sort: string;
		order: string;
	}) => {
		const { search, department, position, status, departmentIds, page, pageSize, sort, order } =
			params;
		const offset = (page - 1) * pageSize;
		const sortCol =
			sort === 'number' ? 'e.number' : sort === 'firstName' ? 'e.first_name' : 'e.last_name';
		const sortDir = order === 'desc' ? 'DESC' : 'ASC';

		// Фильтры собираются параметризованными sql-фрагментами (значения — параметры,
		// не строки), чтобы исключить SQL-инъекцию через поисковые параметры.
		const conds: SQL[] = [];
		if (search)
			conds.push(
				sql`(e.last_name ILIKE ${'%' + search + '%'} OR e.first_name ILIKE ${'%' + search + '%'} OR e.number::text ILIKE ${'%' + search + '%'})`
			);
		if (department) conds.push(sql`dep.name ILIKE ${'%' + department + '%'}`);
		if (position) conds.push(sql`pos.name ILIKE ${'%' + position + '%'}`);
		if (departmentIds) conds.push(sql`dep.id = ANY(${departmentIds})`);
		if (status === 'active') conds.push(sql`last_doc.type IN ('hiring', 'transfer')`);
		if (status === 'dismissed') conds.push(sql`last_doc.type = 'dismissal'`);
		const where = conds.length ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``;

		const query = sql`
			SELECT e.*, dep.name as department_name, pos.name as position_name,
				CASE WHEN last_doc.type = 'dismissal' THEN 'dismissed' WHEN last_doc.id IS NOT NULL THEN 'active' ELSE 'pending' END as status
			FROM ${employee} e
			LEFT JOIN LATERAL (SELECT d.* FROM ${hrDocument} d WHERE d.employee_id = e.id ORDER BY d.date DESC LIMIT 1) last_doc ON true
			LEFT JOIN ${sql.identifier('department')} dep ON dep.id = last_doc.department_id
			LEFT JOIN ${sql.identifier('position')} pos ON pos.id = last_doc.position_id
			${sql.raw(where)}
			ORDER BY ${sql.raw(sortCol)} ${sql.raw(sortDir)}
			LIMIT ${pageSize} OFFSET ${offset}
		`;

		const countQuery = sql`
			SELECT count(*)::int as cnt FROM ${employee} e
			LEFT JOIN LATERAL (SELECT d.* FROM ${hrDocument} d WHERE d.employee_id = e.id ORDER BY d.date DESC LIMIT 1) last_doc ON true
			LEFT JOIN ${sql.identifier('department')} dep ON dep.id = last_doc.department_id
			LEFT JOIN ${sql.identifier('position')} pos ON pos.id = last_doc.position_id
			${sql.raw(where)}
		`;

		const rows: any[] = await db.execute(query).then((r: any) => r || []);
		const countRows: any[] = await db.execute(countQuery).then((r: any) => r || []);

		return {
			employees: rows.map((r: any) => ({
				id: r.id,
				number: r.number,
				lastName: r.last_name,
				firstName: r.first_name,
				middleName: r.middle_name,
				departmentName: r.department_name,
				positionName: r.position_name,
				status: r.status
			})),
			total: Number(countRows[0]?.cnt || 0)
		};
	}
};
