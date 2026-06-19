import { getMssqlPool, closeMssql } from './connect';
import { importDepartments } from './departments';
import { importPositions } from './positions';
import { importSchedules } from './schedules';
import { importEmployees } from './employees';
import { importDayMarks } from './day-marks';
import { importEmployeeSchedules } from './employee-schedules';
import { importWorktime } from './worktime';
import type { IdMap } from './types';

const idMap: IdMap = {
	divisions: new Map(),
	posts: new Map(),
	schedules: new Map(),
	employees: new Map()
};

async function main() {
	console.log('=== Начало импорта из MSSQL ===\n');

	const mssql = await getMssqlPool();

	try {
		// 1. Справочники (независимые)
		console.log('--- 1. Подразделения ---');
		await importDepartments(mssql, idMap);

		console.log('\n--- 2. Должности ---');
		await importPositions(mssql, idMap);

		console.log('\n--- 3. Графики работы ---');
		await importSchedules(mssql, idMap);

		console.log('\n--- 4. Отметки (day_mark) ---');
		await importDayMarks();

		// 2. Сотрудники (зависят от подразделений и должностей)
		console.log('\n--- 5. Сотрудники ---');
		await importEmployees(mssql, idMap);

		// 3. Связи (зависят от сотрудников и графиков)
		console.log('\n--- 6. Связи сотрудник-график ---');
		await importEmployeeSchedules(mssql, idMap);

		// 4. Данные табеля (зависят от сотрудников)
		console.log('\n--- 7. Записи табеля ---');
		await importWorktime(mssql, idMap);

		console.log('\n=== Импорт завершён успешно ===');
	} catch (err) {
		console.error('Ошибка импорта:', err);
		process.exit(1);
	} finally {
		await closeMssql();
	}
}

main();
