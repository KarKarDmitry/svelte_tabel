import sql from 'mssql';
import { db } from './db';
import { schedule } from '../tables/schedule';
import type { IdMap } from './types';

/** Преобразует time ('08:00:00') в минуты */
function timeToMinutes(t: string | null | undefined): number {
	if (!t || t === '') return 480; // по умолчанию 8ч
	const parts = t.split(':');
	return parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
}

export async function importSchedules(mssql: sql.ConnectionPool, idMap: IdMap): Promise<void> {
	const result = await mssql
		.request()
		.query('SELECT ID, Name, StandartWorkTime FROM Schedules ORDER BY ID');
	const rows = result.recordset;

	console.log(`Загрузка графиков: ${rows.length} записей`);

	for (const row of rows) {
		const standardMinutes = timeToMinutes(row.StandartWorkTime);
		const [newRow] = await db
			.insert(schedule)
			.values({
				name: row.Name,
				standardWorkTime: standardMinutes,
				weekDays: '[1,2,3,4,5]' // стандартная 5-дневка
			})
			.returning({ id: schedule.id });
		idMap.schedules.set(row.ID, newRow.id);
	}

	console.log(`Импортировано графиков: ${rows.length}`);
}
