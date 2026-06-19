import sql from 'mssql';
import { db } from './db';
import { position } from '../tables/position';
import type { IdMap } from './types';

export async function importPositions(mssql: sql.ConnectionPool, idMap: IdMap): Promise<void> {
	const result = await mssql
		.request()
		.query('SELECT ID, Name FROM Posts WHERE IsDeleted is null ORDER BY ID');
	const rows = result.recordset;

	console.log(`Загрузка должностей: ${rows.length} записей`);

	for (const row of rows) {
		const [newRow] = await db
			.insert(position)
			.values({ name: row.Name })
			.returning({ id: position.id });
		idMap.posts.set(row.ID, newRow.id);
	}

	console.log(`Импортировано должностей: ${rows.length}`);
}
