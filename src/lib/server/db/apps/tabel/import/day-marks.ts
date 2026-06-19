import { db } from './db';
import { dayMark } from '../tables/day-mark';

/** Маппинг code → id, чтобы использовать при импорте worktime */
export const dayMarkCodeToId = new Map<string, number>();

export async function importDayMarks(): Promise<void> {
	const marks: {
		name: string;
		shortName: string;
		code: string;
		category: 'work' | 'paid_absence' | 'unpaid_absence' | 'violation' | 'day_off';
		reportCode: string | null;
		reportExclude: boolean;
	}[] = [
		{
			name: 'Явка',
			shortName: 'Я',
			code: 'I',
			category: 'work',
			reportCode: null,
			reportExclude: false
		},
		{
			name: 'Ночная смена',
			shortName: 'Н',
			code: 'N',
			category: 'work',
			reportCode: null,
			reportExclude: false
		},
		{
			name: 'Ежегодный отпуск',
			shortName: 'ОТ',
			code: 'OT',
			category: 'paid_absence',
			reportCode: '27',
			reportExclude: false
		},
		{
			name: 'Отпуск по уходу',
			shortName: 'ОД',
			code: 'OD',
			category: 'paid_absence',
			reportCode: '27',
			reportExclude: false
		},
		{
			name: 'Больничный',
			shortName: 'Б',
			code: 'B',
			category: 'paid_absence',
			reportCode: '24',
			reportExclude: false
		},
		{
			name: 'Административный отпуск',
			shortName: 'АО',
			code: 'AO',
			category: 'unpaid_absence',
			reportCode: null,
			reportExclude: false
		},
		{
			name: 'Прогул',
			shortName: 'ПР',
			code: 'PR',
			category: 'violation',
			reportCode: null,
			reportExclude: false
		},
		{
			name: 'Выходной',
			shortName: 'В',
			code: 'W',
			category: 'day_off',
			reportCode: null,
			reportExclude: false
		},
		{
			name: 'Командировка',
			shortName: 'К',
			code: 'K',
			category: 'paid_absence',
			reportCode: '7.1',
			reportExclude: false
		},
		{
			name: 'Отпуск за свой счёт',
			shortName: 'Д',
			code: 'D',
			category: 'unpaid_absence',
			reportCode: '33',
			reportExclude: false
		}
	];

	console.log(`Загрузка отметок: ${marks.length} записей`);

	// Сначала удаляем старые (если повторный запуск)
	await db.delete(dayMark);

	for (const m of marks) {
		const [row] = await db
			.insert(dayMark)
			.values(m)
			.returning({ id: dayMark.id, code: dayMark.code });
		dayMarkCodeToId.set(row.code, row.id);
	}

	console.log(`Импортировано отметок: ${marks.length}`);
}
