import sql from 'mssql';
import { db } from './db';
import { department } from '../tables/department';
import type { IdMap } from './types';

export async function importDepartments(mssql: sql.ConnectionPool, idMap: IdMap): Promise<void> {
	const result = await mssql
		.request()
		.query('SELECT ID, Name FROM Divisions WHERE IsDeleted is null ORDER BY ID');
	const rows = result.recordset;

	console.log(`Загрузка подразделений: ${rows.length} записей`);

	for (const row of rows) {
		const [newRow] = await db
			.insert(department)
			.values({ name: row.Name })
			.returning({ id: department.id });
		idMap.divisions.set(row.ID, newRow.id);
	}

	console.log(`Импортировано подразделений: ${rows.length}`);
}
