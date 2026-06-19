import sql from 'mssql';
import { db } from './db';
import { worktimeTracker } from '../tables/worktime-tracker';
import { SHORTNAME_TO_CODE } from './types';
import type { IdMap, OldWorkTimeRow } from './types';

/** Decimal часы → integer минуты */
function hoursToMinutes(h: number | null): number | null {
	if (h == null) return null;
	return Math.round(Number(h) * 60);
}

export async function importWorktime(mssql: sql.ConnectionPool, idMap: IdMap): Promise<void> {
	// Определяем, какая таблица используется
	const settingsResult = await mssql
		.request()
		.query('SELECT TOP 1 1 FROM WorkTimeTrackerMaster WHERE 1=0');
	const tableName = 'WorkTimeTrackerMaster'; // всегда мастер, т.к. основная

	const result = await mssql.request().query(
		`SELECT Employee, Date, WorkTime, NightHours, IsNightShift, DayMarkCode, ChangedManually
		 FROM ${tableName} ORDER BY Employee, Date`
	);
	const rows: OldWorkTimeRow[] = result.recordset;

	console.log(`Загрузка записей табеля: ${rows.length} записей`);

	let count = 0;
	for (const row of rows) {
		const newEmpId = idMap.employees.get(row.employee);
		if (!newEmpId) continue;

		const rawCode = row.dayMarkCode?.trim() ?? '';
		const code = SHORTNAME_TO_CODE[rawCode] ?? rawCode;

		const reportMinutes = hoursToMinutes(row.workTime);
		const nightMinutes = hoursToMinutes(row.nightHours);

		await db.insert(worktimeTracker).values({
			employeeId: newEmpId,
			date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
			isNightShift: row.isNightShift ?? false,
			dayMarkCode: code || null,
			rawWorkTime: reportMinutes,
			rawNightWorkTime: nightMinutes,
			shiftWorkTime: reportMinutes,
			shiftNightWorkTime: nightMinutes,
			reportWorkTime: reportMinutes,
			reportNightWorkTime: nightMinutes
		});

		count++;
		if (count % 500 === 0) console.log(`  ... обработано ${count}/${rows.length}`);
	}

	console.log(`Импортировано записей табеля: ${count}`);
}
