import sql from 'mssql';
import { db } from './db';
import { employee } from '../tables/employee';
import { hrDocument } from '../tables/document';
import type { IdMap, OldEmployeeRow } from './types';

export async function importEmployees(mssql: sql.ConnectionPool, idMap: IdMap): Promise<void> {
	const result = await mssql.request().query(
		`SELECT ID, Number, LastName, FirstName, Patronymic, Post, Division, IsTimeWorker
		 FROM Employees WHERE IsDeleted is null ORDER BY ID`
	);
	const rows: OldEmployeeRow[] = result.recordset;

	console.log(`Загрузка сотрудников: ${rows.length} записей`);

	for (const row of rows) {
		const [newEmp] = await db
			.insert(employee)
			.values({
				number: String(row.number ?? ''),
				lastName: row.lastName ?? '',
				firstName: row.firstName ?? '',
				middleName: row.patronymic ?? null
			})
			.returning({ id: employee.id });

		idMap.employees.set(row.ID, newEmp.id);

		// Создаём кадровый документ с отделом и должностью
		const deptId = idMap.divisions.get(row.division ?? 0);
		const posId = idMap.posts.get(row.post ?? 0);

		await db.insert(hrDocument).values({
			type: 'hiring',
			date: '2000-01-01',
			employeeId: newEmp.id,
			departmentId: deptId ?? 1,
			positionId: posId ?? 1
		});
	}

	console.log(`Импортировано сотрудников: ${rows.length}`);
}
