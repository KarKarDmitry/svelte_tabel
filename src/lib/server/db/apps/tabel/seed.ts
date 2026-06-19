/*  */ import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error('❌ DATABASE_URL is not set');
	process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

async function seed() {
	console.log('🌱 Seeding tabel...');

	// === 1. Справочники ===

	// --- department ---
	const deps = await db
		.insert(schema.department)
		.values([
			{ name: 'Администрация' },
			{ name: 'Бухгалтерия' },
			{ name: 'Отдел кадров' },
			{ name: 'Производственный цех №1' },
			{ name: 'Производственный цех №2' },
			{ name: 'Склад' },
			{ name: 'Служба безопасности' },
			{ name: 'IT-отдел' }
		])
		.returning();
	console.log(`  ✓ departments: ${deps.length}`);

	// --- position ---
	const positions = await db
		.insert(schema.position)
		.values([
			{ name: 'Генеральный директор' },
			{ name: 'Главный бухгалтер' },
			{ name: 'Начальник цеха' },
			{ name: 'Инженер' },
			{ name: 'Сварщик' },
			{ name: 'Токарь' },
			{ name: 'Фрезеровщик' },
			{ name: 'Разнорабочий' },
			{ name: 'Охранник' },
			{ name: 'Кладовщик' },
			{ name: 'Системный администратор' },
			{ name: 'Уборщик' }
		])
		.returning();
	console.log(`  ✓ positions: ${positions.length}`);

	// --- day_mark ---
	await db.insert(schema.dayMark).values([
		{ name: 'Явка', shortName: 'Я', code: 'Я', category: 'work', reportExclude: false },
		{ name: 'Ночная смена', shortName: 'Н', code: 'Н', category: 'work', reportExclude: false },
		{
			name: 'Ежегодный отпуск',
			shortName: 'ОТ',
			code: 'ОТ',
			category: 'paid_absence',
			reportCode: '27',
			reportExclude: false
		},
		{
			name: 'Отпуск по уходу',
			shortName: 'ОД',
			code: 'ОД',
			category: 'paid_absence',
			reportCode: '27',
			reportExclude: false
		},
		{
			name: 'Больничный',
			shortName: 'Б',
			code: 'Б',
			category: 'paid_absence',
			reportCode: '24',
			reportExclude: false
		},
		{
			name: 'Административный отпуск',
			shortName: 'АО',
			code: 'АО',
			category: 'unpaid_absence',
			reportExclude: false
		},
		{ name: 'Прогул', shortName: 'ПР', code: 'ПР', category: 'violation', reportExclude: false },
		{ name: 'Выходной', shortName: 'В', code: 'В', category: 'day_off', reportExclude: false },
		{
			name: 'Командировка',
			shortName: 'К',
			code: 'К',
			category: 'paid_absence',
			reportCode: '7.1',
			reportExclude: false
		},
		{
			name: 'Отпуск за свой счёт',
			shortName: 'Д',
			code: 'Д',
			category: 'unpaid_absence',
			reportCode: '33',
			reportExclude: false
		}
	]);
	console.log('  ✓ day_marks: 10');

	// --- app_constant ---
	await db.insert(schema.appConstant).values([
		{
			key: 'NIGHT_SHIFT_START',
			value: '22:00',
			isJson: false,
			hint: 'Начало ночной смены (ЧЧ:ММ)'
		},
		{ key: 'NIGHT_SHIFT_END', value: '06:00', isJson: false, hint: 'Конец ночной смены (ЧЧ:ММ)' },
		{
			key: 'SHIFT_MARK_SHORTNAMES',
			value: 'Я,Н',
			isJson: false,
			hint: 'Отметки явки через запятую, для которых подставляются часы из графика'
		},
		{
			key: 'CELL_COLOR_RULES',
			isJson: true,
			hint: 'Правила окраски ячеек табеля: overwork, underwork, missedWorkday, missingHours, weekendWork, outOfPeriod',
			value: JSON.stringify({
				overwork: { bg: '#fef9c3' },
				underwork: { bg: '#ffedd5' },
				missedWorkday: { bg: '#fee2e2' },
				missingHours: { bg: '#fecaca' },
				weekendWork: { bg: '#bbf7d0' },
				outOfPeriod: { bg: '#f3f4f6' }
			})
		},
		{
			key: 'MARK_COLOR_RULES',
			isJson: true,
			hint: 'Особенные цвета для конкретных отметок. Ключи — shortName отметки. Каждая: { bg, color, fontWeight }',
			value: JSON.stringify({
				'\u041f\u0420': { bg: '#fee2e2', color: '#991b1b', fontWeight: 'bold' },
				'\u0411': { bg: '#f3e8ff', color: '#6b21a8' },
				'\u0410\u041e': { bg: '#fef3c7', color: '#92400e' },
				'\u0414': { bg: '#fef9c3', color: '#854d0e' }
			})
		}
	]);
	console.log('  ✓ app_constants: 5');

	// --- department_group ---
	const groups = await db
		.insert(schema.departmentGroup)
		.values([
			{ name: 'АУП (ИТР)', sortOrder: 1 },
			{ name: 'Основные', sortOrder: 2 },
			{ name: 'Вспомогательные', sortOrder: 3 }
		])
		.returning();
	console.log(`  ✓ department_groups: ${groups.length}`);

	// --- department_group_member ---
	await db.insert(schema.departmentGroupMember).values([
		{
			groupId: groups.find((g: any) => g.name === 'АУП (ИТР)')!.id,
			departmentId: deps.find((d: any) => d.name === 'Администрация')!.id
		},
		{
			groupId: groups.find((g: any) => g.name === 'АУП (ИТР)')!.id,
			departmentId: deps.find((d: any) => d.name === 'Бухгалтерия')!.id
		},
		{
			groupId: groups.find((g: any) => g.name === 'АУП (ИТР)')!.id,
			departmentId: deps.find((d: any) => d.name === 'Отдел кадров')!.id
		},
		{
			groupId: groups.find((g: any) => g.name === 'АУП (ИТР)')!.id,
			departmentId: deps.find((d: any) => d.name === 'IT-отдел')!.id
		},
		{
			groupId: groups.find((g: any) => g.name === 'Основные')!.id,
			departmentId: deps.find((d: any) => d.name === 'Производственный цех №1')!.id
		},
		{
			groupId: groups.find((g: any) => g.name === 'Основные')!.id,
			departmentId: deps.find((d: any) => d.name === 'Производственный цех №2')!.id
		},
		{
			groupId: groups.find((g: any) => g.name === 'Вспомогательные')!.id,
			departmentId: deps.find((d: any) => d.name === 'Склад')!.id
		},
		{
			groupId: groups.find((g: any) => g.name === 'Вспомогательные')!.id,
			departmentId: deps.find((d: any) => d.name === 'Служба безопасности')!.id
		}
	]);
	console.log('  ✓ department_group_members: 8');

	// --- pass ---
	const passes = await db
		.insert(schema.pass)
		.values([
			{ seria: 'A', number: '001' },
			{ seria: 'A', number: '002' },
			{ seria: 'A', number: '003' },
			{ seria: 'A', number: '004' },
			{ seria: 'A', number: '005' },
			{ seria: 'B', number: '001' },
			{ seria: 'B', number: '002' },
			{ seria: 'B', number: '003' },
			{ seria: 'C', number: '001' },
			{ seria: 'C', number: '002' },
			{ seria: 'C', number: '003' },
			{ seria: 'D', number: '001' },
			{ seria: 'D', number: '002' }
		])
		.returning();
	console.log(`  ✓ passes: ${passes.length}`);

	// --- schedule ---
	const schedules = await db
		.insert(schema.schedule)
		.values([
			{
				name: 'Стандартный 8:00–17:00',
				standardWorkTime: 480,
				weekDays: JSON.stringify([1, 2, 3, 4, 5])
			},
			{
				name: 'Сокращённый 8:00–16:00',
				standardWorkTime: 420,
				weekDays: JSON.stringify([1, 2, 3, 4, 5])
			},
			{ name: 'Дневная смена 6:00–18:00', standardWorkTime: 660, weekDays: null },
			{ name: 'Ночная смена 18:00–6:00', standardWorkTime: 660, weekDays: null },
			{ name: 'Суточный 8:00–8:00', standardWorkTime: 1320, weekDays: null }
		])
		.returning();
	console.log(`  ✓ schedules: ${schedules.length}`);

	// --- calendar_template ---
	const templates = await db
		.insert(schema.calendarTemplate)
		.values([
			{
				name: 'Производственный календарь',
				year: 0,
				defaultWorkDays: JSON.stringify([1, 2, 3, 4, 5]),
				defaultWorkTime: 480
			}
		])
		.returning();
	console.log('  ✓ calendar_templates: 1');

	// --- calendar_template_rule ---
	await db.insert(schema.calendarTemplateRule).values([
		// Январь
		{
			templateId: templates[0].id,
			month: 1,
			day: 1,
			autoTransfer: false,
			preHoliday: true,
			preScheduleId: schedules[1].id
		},
		{ templateId: templates[0].id, month: 1, day: 2, autoTransfer: false, preHoliday: false },
		{ templateId: templates[0].id, month: 1, day: 3, autoTransfer: false, preHoliday: false },
		{ templateId: templates[0].id, month: 1, day: 4, autoTransfer: true, preHoliday: false },
		{ templateId: templates[0].id, month: 1, day: 5, autoTransfer: true, preHoliday: false },
		{ templateId: templates[0].id, month: 1, day: 6, autoTransfer: false, preHoliday: false },
		{ templateId: templates[0].id, month: 1, day: 7, autoTransfer: false, preHoliday: false },
		{ templateId: templates[0].id, month: 1, day: 8, autoTransfer: false, preHoliday: false },
		// Февраль
		{
			templateId: templates[0].id,
			month: 2,
			day: 23,
			autoTransfer: true,
			preHoliday: true,
			preScheduleId: schedules[1].id
		},
		// Март
		{
			templateId: templates[0].id,
			month: 3,
			day: 8,
			autoTransfer: true,
			preHoliday: true,
			preScheduleId: schedules[1].id
		},
		// Май
		{
			templateId: templates[0].id,
			month: 5,
			day: 1,
			autoTransfer: false,
			preHoliday: true,
			preScheduleId: schedules[1].id
		},
		{
			templateId: templates[0].id,
			month: 5,
			day: 9,
			autoTransfer: false,
			preHoliday: true,
			preScheduleId: schedules[1].id
		},
		// Июнь
		{
			templateId: templates[0].id,
			month: 6,
			day: 12,
			autoTransfer: false,
			preHoliday: true,
			preScheduleId: schedules[1].id
		},
		// Ноябрь
		{
			templateId: templates[0].id,
			month: 11,
			day: 4,
			autoTransfer: false,
			preHoliday: true,
			preScheduleId: schedules[1].id
		}
	]);
	console.log('  ✓ calendar_template_rules');

	// --- turnstile_event ---
	const events = await db
		.insert(schema.turnstileEvent)
		.values([
			{ name: 'Вход по пропуску', direction: 'entry' },
			{ name: 'Выход по пропуску', direction: 'exit' }
		])
		.returning();
	console.log('  ✓ turnstile_events: 2');

	// === 2. Сотрудники ===

	const employees = await db
		.insert(schema.employee)
		.values([
			{ number: '001', lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович' },
			{ number: '002', lastName: 'Петров', firstName: 'Пётр', middleName: 'Петрович' },
			{ number: '003', lastName: 'Сидоров', firstName: 'Сидор', middleName: 'Сидорович' },
			{ number: '004', lastName: 'Кузнецов', firstName: 'Николай', middleName: 'Сергеевич' },
			{ number: '005', lastName: 'Попов', firstName: 'Алексей', middleName: 'Викторович' },
			{ number: '006', lastName: 'Васильев', firstName: 'Дмитрий', middleName: 'Андреевич' },
			{ number: '007', lastName: 'Михайлов', firstName: 'Антон', middleName: 'Владимирович' },
			{ number: '008', lastName: 'Новиков', firstName: 'Максим', middleName: 'Олегович' },
			{ number: '009', lastName: 'Фёдоров', firstName: 'Артём', middleName: 'Павлович' },
			{ number: '010', lastName: 'Морозов', firstName: 'Владимир', middleName: 'Игоревич' },
			{ number: '011', lastName: 'Волкова', firstName: 'Елена', middleName: 'Владимировна' },
			{ number: '012', lastName: 'Козлова', firstName: 'Ольга', middleName: 'Алексеевна' },
			{ number: '013', lastName: 'Смирнова', firstName: 'Татьяна', middleName: 'Юрьевна' },
			{ number: '014', lastName: 'Крылов', firstName: 'Алексей', middleName: 'Николаевич' },
			{ number: '015', lastName: 'Зайцев', firstName: 'Павел', middleName: 'Анатольевич' }
		])
		.returning();
	console.log(`  ✓ employees: ${employees.length}`);

	// === 3. Связи ===

	const stdSchedule = schedules[0];
	const reducedSchedule = schedules[1];
	const daySchedule = schedules[2];
	const nightSchedule = schedules[3];

	// --- schedule_point ---
	await db.insert(schema.schedulePoint).values([
		{ scheduleId: stdSchedule.id, type: 'Entry', time: '08:00', leftBound: 15, rightBound: 15 },
		{
			scheduleId: stdSchedule.id,
			type: 'Break',
			time: '12:00',
			endTime: '13:00',
			leftBound: 5,
			rightBound: 5
		},
		{ scheduleId: stdSchedule.id, type: 'Exit', time: '17:00', leftBound: 15, rightBound: 15 },
		{ scheduleId: reducedSchedule.id, type: 'Entry', time: '08:00', leftBound: 15, rightBound: 15 },
		{
			scheduleId: reducedSchedule.id,
			type: 'Break',
			time: '12:00',
			endTime: '12:30',
			leftBound: 5,
			rightBound: 5
		},
		{ scheduleId: reducedSchedule.id, type: 'Exit', time: '16:00', leftBound: 15, rightBound: 15 },
		{ scheduleId: daySchedule.id, type: 'Entry', time: '06:00', leftBound: 30, rightBound: 15 },
		{
			scheduleId: daySchedule.id,
			type: 'Break',
			time: '10:00',
			endTime: '10:30',
			leftBound: 10,
			rightBound: 10
		},
		{
			scheduleId: daySchedule.id,
			type: 'Break',
			time: '14:00',
			endTime: '14:30',
			leftBound: 10,
			rightBound: 10
		},
		{ scheduleId: daySchedule.id, type: 'Exit', time: '18:00', leftBound: 15, rightBound: 30 },
		{ scheduleId: nightSchedule.id, type: 'Entry', time: '18:00', leftBound: 30, rightBound: 15 },
		{
			scheduleId: nightSchedule.id,
			type: 'Break',
			time: '22:00',
			endTime: '22:30',
			leftBound: 10,
			rightBound: 10
		},
		{
			scheduleId: nightSchedule.id,
			type: 'Break',
			time: '02:00',
			endTime: '02:30',
			leftBound: 10,
			rightBound: 10
		},
		{ scheduleId: nightSchedule.id, type: 'Exit', time: '06:00', leftBound: 15, rightBound: 30 }
	]);
	console.log('  ✓ schedule_points: 20');

	// --- employee_schedule ---
	await db.insert(schema.employeeSchedule).values([
		{ employeeId: employees[0].id, scheduleId: stdSchedule.id },
		{ employeeId: employees[1].id, scheduleId: stdSchedule.id },
		{ employeeId: employees[2].id, scheduleId: stdSchedule.id },
		{ employeeId: employees[10].id, scheduleId: stdSchedule.id },
		{ employeeId: employees[11].id, scheduleId: stdSchedule.id },
		{ employeeId: employees[12].id, scheduleId: stdSchedule.id },
		{ employeeId: employees[3].id, scheduleId: daySchedule.id },
		{ employeeId: employees[3].id, scheduleId: nightSchedule.id },
		{ employeeId: employees[4].id, scheduleId: daySchedule.id },
		{ employeeId: employees[4].id, scheduleId: nightSchedule.id },
		{ employeeId: employees[5].id, scheduleId: daySchedule.id },
		{ employeeId: employees[6].id, scheduleId: daySchedule.id },
		{ employeeId: employees[7].id, scheduleId: nightSchedule.id },
		{ employeeId: employees[8].id, scheduleId: daySchedule.id },
		{ employeeId: employees[9].id, scheduleId: nightSchedule.id }
	]);
	console.log('  ✓ employee_schedules: 15');

	// --- employee_pass ---
	await db
		.insert(schema.employeePass)
		.values(
			employees
				.slice(0, 13)
				.map((emp, i) => ({ employeeId: emp.id, passId: passes[i].id, dateFrom: '2025-01-09' }))
		);
	console.log('  ✓ employee_passes: 13');

	// --- hr_document ---
	await db.insert(schema.hrDocument).values([
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-001',
			employeeId: employees[0].id,
			departmentId: deps[0].id,
			positionId: positions[0].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-002',
			employeeId: employees[1].id,
			departmentId: deps[1].id,
			positionId: positions[1].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-003',
			employeeId: employees[2].id,
			departmentId: deps[2].id,
			positionId: positions[0].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-004',
			employeeId: employees[3].id,
			departmentId: deps[3].id,
			positionId: positions[2].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-005',
			employeeId: employees[4].id,
			departmentId: deps[3].id,
			positionId: positions[4].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-006',
			employeeId: employees[5].id,
			departmentId: deps[3].id,
			positionId: positions[5].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-007',
			employeeId: employees[6].id,
			departmentId: deps[4].id,
			positionId: positions[2].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-008',
			employeeId: employees[7].id,
			departmentId: deps[4].id,
			positionId: positions[6].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-009',
			employeeId: employees[8].id,
			departmentId: deps[5].id,
			positionId: positions[9].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-010',
			employeeId: employees[9].id,
			departmentId: deps[6].id,
			positionId: positions[8].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-011',
			employeeId: employees[10].id,
			departmentId: deps[1].id,
			positionId: positions[3].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-012',
			employeeId: employees[11].id,
			departmentId: deps[1].id,
			positionId: positions[3].id
		},
		{
			type: 'hiring',
			date: '2025-01-09',
			docNumber: 'П-013',
			employeeId: employees[12].id,
			departmentId: deps[2].id,
			positionId: positions[1].id
		}
	]);
	console.log('  ✓ hr_documents: 13');

	// Календарные дни генерируются через UI

	// --- turnstile_event_tracker ---
	const trackerData = [];
	const baseDate = new Date(2025, 0, 9);

	for (let day = 0; day < 5; day++) {
		for (const emp of employees.slice(0, 5)) {
			const d = new Date(baseDate);
			d.setDate(d.getDate() + day);

			const entry = new Date(d);
			entry.setHours(7, 55 + Math.floor(Math.random() * 10), 0, 0);
			const lunchS = new Date(d);
			lunchS.setHours(12, Math.floor(Math.random() * 5), 0, 0);
			const lunchE = new Date(d);
			lunchE.setHours(13, Math.floor(Math.random() * 5), 0, 0);
			const exit = new Date(d);
			exit.setHours(17, Math.floor(Math.random() * 15), 0, 0);

			trackerData.push(
				{ employeeId: emp.id, passId: emp.id, datetime: entry, eventId: events[0].id },
				{ employeeId: emp.id, passId: emp.id, datetime: lunchS, eventId: events[1].id },
				{ employeeId: emp.id, passId: emp.id, datetime: lunchE, eventId: events[0].id },
				{ employeeId: emp.id, passId: emp.id, datetime: exit, eventId: events[1].id }
			);
		}
	}

	await db.insert(schema.turnstileEventTracker).values(trackerData);
	console.log(`  ✓ turnstile_event_trackers: ${trackerData.length}`);

	// --- worktime_tracker ---
	const wtData = [];
	for (let day = 0; day < 5; day++) {
		const d = new Date(baseDate);
		d.setDate(d.getDate() + day);
		const dateStr = d.toISOString().split('T')[0];

		for (const emp of employees.slice(0, 5)) {
			wtData.push({
				employeeId: emp.id,
				date: dateStr,
				isNightShift: false,
				dayMarkCode: 'I',
				rawWorkTime: 480 + Math.floor(Math.random() * 30) - 15,
				rawNightWorkTime: 0,
				shiftWorkTime: 480,
				shiftNightWorkTime: 0,
				reportWorkTime: 480,
				reportNightWorkTime: 0
			});
		}
	}

	await db.insert(schema.worktimeTracker).values(wtData);
	console.log(`  ✓ worktime_trackers: ${wtData.length}`);

	console.log('\n✅ Seed completed!');
}

seed()
	.catch((e) => {
		console.error('❌ Seed failed:', e);
		process.exit(1);
	})
	.finally(() => process.exit(0));
