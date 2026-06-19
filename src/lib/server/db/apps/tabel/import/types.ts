/** Маппинг старых ID (MSSQL) → новые ID (PostgreSQL) */
export interface IdMap {
	divisions: Map<number, number>;
	posts: Map<number, number>;
	schedules: Map<number, number>;
	employees: Map<number, number>;
}

/** Строка из старой таблицы WorkTimeTracker */
export interface OldWorkTimeRow {
	employee: number;
	date: Date;
	workTime: number | null;
	nightHours: number | null;
	isNightShift: boolean | null;
	dayMarkCode: string | null;
	changedManually: boolean | null;
}

/** Строка из старой таблицы Employees */
export interface OldEmployeeRow {
	ID: number;
	number: string;
	lastName: string;
	firstName: string;
	patronymic: string | null;
	post: number | null;
	division: number | null;
	isTimeWorker: boolean | null;
}

/** Строка из старой таблицы Schedules */
export interface OldScheduleRow {
	ID: number;
	name: string;
	ArrivalTime: string;
	DepartureTime: string;
	StandartWorkTime: string;
}

/** Строка из EmployeeSchedules */
export interface OldEmpScheduleRow {
	ID: number;
	employee: number;
	schedule: number;
}

/** shortName → code (сейчас code = shortName) */
export const SHORTNAME_TO_CODE: Record<string, string> = {
	Я: 'Я',
	Н: 'Н',
	ОТ: 'ОТ',
	ОД: 'ОД',
	ОА: 'ОА',
	ОД1: 'ОД1',
	ДС: 'ДС',
	У: 'У',
	УД: 'УД',
	ОР: 'ОР',
	ОЖ: 'ОЖ',
	ОЗ: 'ОЗ',
	Д: 'Д',
	К: 'К',
	С: 'С',
	РВ: 'РВ',
	Б: 'Б',
	БТ: 'БТ',
	Г: 'Г',
	ОВ: 'ОВ',
	НП: 'НП',
	НОД: 'НОД',
	ПР: 'ПР',
	В: 'В'
};
