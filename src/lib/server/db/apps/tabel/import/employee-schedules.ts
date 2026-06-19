import sql from 'mssql';
import { db } from './db';
import { employeeSchedule } from '../tables/employee-schedule';
import type { IdMap, OldEmpScheduleRow } from './types';

export async function importEmployeeSchedules(
	mssql: sql.ConnectionPool,
	idMap: IdMap
): Promise<void> {
	const result = await mssql
		.request()
		.query('SELECT ID, Employee, Schedule FROM EmployeeSchedules ORDER BY ID');
	const rows: OldEmpScheduleRow[] = result.recordset;

	console.log(`Загрузка связей сотрудник-график: ${rows.length} записей`);

	for (const row of rows) {
		const newEmpId = idMap.employees.get(row.employee);
		const newSchedId = idMap.schedules.get(row.schedule);
		if (!newEmpId || !newSchedId) continue;

		await db.insert(employeeSchedule).values({
			employeeId: newEmpId,
			scheduleId: newSchedId,
			dateFrom: null,
			dateTo: null
		});
	}

	console.log(`Импортировано связей: ${rows.length}`);
}
