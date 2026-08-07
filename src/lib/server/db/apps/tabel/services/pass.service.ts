import { db } from '$lib/server/db';
import { pass } from '../tables/pass';
import { employeePass } from '../tables/employee-pass';
import { employee } from '../tables/employee';
import { eq, and, isNull } from 'drizzle-orm';

export const passService = {
	list: () => db.select().from(pass).orderBy(pass.seria, pass.number),

	/** Список пропусков с текущим владельцем */
	listWithOwners: () =>
		db
			.select({
				pass,
				owner: {
					id: employee.id,
					lastName: employee.lastName,
					firstName: employee.firstName,
					middleName: employee.middleName,
					number: employee.number
				}
			})
			.from(pass)
			.leftJoin(employeePass, and(eq(employeePass.passId, pass.id), isNull(employeePass.dateTo)))
			.leftJoin(employee, eq(employee.id, employeePass.employeeId))
			.orderBy(pass.seria, pass.number),

	getById: (id: number) =>
		db
			.select()
			.from(pass)
			.where(eq(pass.id, id))
			.then((r) => r[0]),

	create: (data: { seria?: string | null; number: string }) =>
		db
			.insert(pass)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (id: number, data: { seria?: string | null; number?: string }) =>
		db
			.update(pass)
			.set(data)
			.where(eq(pass.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(pass).where(eq(pass.id, id)),

	/** Получить текущий пропуск сотрудника (без dateTo) */
	getCurrentByEmployee: (employeeId: number) =>
		db
			.select({ pass, employeePass })
			.from(employeePass)
			.innerJoin(pass, eq(pass.id, employeePass.passId))
			.where(and(eq(employeePass.employeeId, employeeId), isNull(employeePass.dateTo)))
			.then((r) => r[0]),

	/** Получить все пропуска сотрудника (история) */
	getHistoryByEmployee: (employeeId: number) =>
		db
			.select({ pass, employeePass })
			.from(employeePass)
			.innerJoin(pass, eq(pass.id, employeePass.passId))
			.where(eq(employeePass.employeeId, employeeId))
			.orderBy(employeePass.dateFrom),

	/** Получить все активные назначения пропусков (без dateTo) */
	listActiveAssignments: () =>
		db
			.select({
				id: employeePass.id,
				employeeId: employeePass.employeeId,
				passId: employeePass.passId
			})
			.from(employeePass)
			.where(isNull(employeePass.dateTo)),

	/** Проверить, назначен ли пропуск другому сотруднику */
	getActiveAssignment: (passId: number, excludeEmployeeId?: number) =>
		db
			.select({ id: employeePass.id, employeeId: employeePass.employeeId })
			.from(employeePass)
			.where(and(eq(employeePass.passId, passId), isNull(employeePass.dateTo)))
			.limit(1)
			.then((r) => r[0]),

	/** Назначить пропуск сотруднику */
	assignToEmployee: (data: { employeeId: number; passId: number; dateFrom: string }) =>
		db
			.insert(employeePass)
			.values(data)
			.returning()
			.then((r) => r[0]),

	/** Получить назначение пропуска по ID (для проверок) */
	getEmployeePassById: (id: number) =>
		db
			.select()
			.from(employeePass)
			.where(eq(employeePass.id, id))
			.then((r) => r[0]),

	/** Закрыть конкретную запись пропуска по ID */
	closeEmployeePass: (id: number, dateTo: string) =>
		db.update(employeePass).set({ dateTo }).where(eq(employeePass.id, id)),

	/** Закрыть текущий пропуск сотрудника (установить dateTo) */
	closeCurrent: (employeeId: number, dateTo: string) =>
		db
			.update(employeePass)
			.set({ dateTo })
			.where(and(eq(employeePass.employeeId, employeeId), isNull(employeePass.dateTo))),

	removeEmployeePass: (id: number) => db.delete(employeePass).where(eq(employeePass.id, id))
};
