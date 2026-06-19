import Excel from 'exceljs';

type GroupInfo = { name: string; departments: { departmentId: number }[] };
type DayData = {
	date: string;
	dayMarkCode: string;
	reportWorkTime: number | null;
	reportNightWorkTime: number | null;
};
type EmployeeRow = {
	number: string;
	fullName: string;
	position: string;
	days: DayData[];
	totalHours: number;
	nightHours: number;
	overtimeHours: number;
	weekendHolidayHours: number;
};

interface RoundingConfig {
	holidays: Set<number>;
	// округление по временной точке
	roundingPoint: number | null; // часы
	roundingFrom: number | null; // часы
	roundingTo: number | null; // часы
	// округление по стандарту
	standardLeft: number; // часов (отрицательное смещение)
	standardRight: number; // часов (положительное смещение)
	// стандартное время для текущего сотрудника (заполняется в writeEmployee)
	scheduleStandardTime: number | null; // минуты
}

const FONT = { name: 'Times New Roman', size: 6 };
const E_FONT = { name: 'Times New Roman', size: 9 };
const EMP_FONT = { name: 'Times New Roman', size: 10 };
const BORDER = {
	top: { style: 'thin' as const },
	bottom: { style: 'thin' as const },
	left: { style: 'thin' as const },
	right: { style: 'thin' as const }
};
const EMP_BORDER = { ...BORDER, bottom: { style: 'medium' as const } };
const ALIGN_CENTER = {
	horizontal: 'center' as const,
	vertical: 'middle' as const,
	wrapText: true as const
};

const COL_WIDTHS: [number | [number, number], number][] = [
	[1, 5],
	[2, 30],
	[3, 5],
	[[4, 18], 3],
	[19, 6.7],
	[[20, 35], 3],
	[[36, 44], 6.7],
	[45, 7.1],
	[46, 6.7]
];

const HEADER_HEIGHTS: [number | [number, number], number][] = [
	[0, 12.75],
	[1, 19.5],
	[2, 7.5],
	[3, 18],
	[4, 7.5],
	[5, 7.5],
	[6, 25]
];

const ROW_HEIGHT = 35;

/**
 * Округление рабочего времени по правилам (как в Python round_work_time)
 * @param workTimeMinutes - время в минутах
 * @param rounding - конфиг округления
 * @param decreaseByHoliday - вычесть 1 час если праздничный день
 */
function roundWorkTime(
	workTimeMinutes: number | null,
	rounding: RoundingConfig | null,
	decreaseByHoliday = 0
): number | null {
	if (workTimeMinutes == null) return null;

	const workHours = workTimeMinutes / 60;

	if (!rounding) {
		return Math.round(workHours);
	}

	// Если нет ни одного активного правила округления
	if (
		rounding.roundingPoint == null &&
		rounding.roundingFrom == null &&
		rounding.roundingTo == null
	) {
		return Math.round(workHours);
	}

	let isRounded = false;
	let resultValue = workHours;

	// Округление по стандарту
	if (
		rounding.roundingFrom != null &&
		rounding.roundingTo != null &&
		rounding.roundingPoint != null
	) {
		const leftBound = rounding.roundingFrom;
		const rightBound = rounding.roundingTo;
		if (leftBound < workHours && workHours < rightBound) {
			isRounded = true;
			resultValue = rounding.roundingPoint;
		}
	}

	// Округление по стандарту со сдвигом (standart)
	if (
		rounding.scheduleStandardTime != null &&
		(rounding.standardLeft !== 0 || rounding.standardRight !== 0)
	) {
		const stdHours = rounding.scheduleStandardTime / 60;
		const leftBoundStd = stdHours + rounding.standardLeft;
		const rightBoundStd = stdHours + rounding.standardRight;
		if (workHours != null && leftBoundStd < workHours && workHours < rightBoundStd) {
			isRounded = true;
			resultValue = stdHours;
		}
	}

	if (isRounded) {
		return Math.max(0, resultValue - decreaseByHoliday);
	}

	return Math.round(workHours);
}

export async function buildT12(
	groups: GroupInfo[],
	departments: any[],
	dayMarks: any[],
	year: number,
	month: number,
	lastDay: number,
	onProgress?: (division: string, employee: string) => void,
	holidays?: Set<number>,
	roundingConfig?: Omit<RoundingConfig, 'scheduleStandardTime'> | null,
	calendarDays?: Record<string, { dayType: string; workTime: number | null }>,
	shiftMarkShortnames?: string[]
): Promise<Buffer> {
	const wb = new Excel.Workbook();
	wb.creator = 'mettem';

	// Маппинг code → полный объект отметки (для lookup категории, reportCode и т.д.)
	const markByCodeObj = new Map(dayMarks.map((m: any) => [m.code, m]));
	const markByShortObj = new Map(dayMarks.map((m: any) => [m.shortName, m]));

	// Множество кодов отметок, считающихся «рабочими» (SHIFT_MARK_SHORTNAMES)
	const shiftMarkCodes = new Set<string>();
	if (shiftMarkShortnames) {
		for (const sn of shiftMarkShortnames) {
			const obj = markByShortObj.get(sn);
			if (obj) shiftMarkCodes.add(obj.code);
		}
	}

	// Множество дней месяца, являющихся рабочими по календарю
	const workDayIndices = new Set<number>();
	if (calendarDays) {
		for (const [dateStr, info] of Object.entries(calendarDays)) {
			if (
				info.dayType === 'workday' ||
				info.dayType === 'preholiday' ||
				info.dayType === 'transferred_workday'
			) {
				const day = parseInt(dateStr.split('-')[2], 10);
				workDayIndices.add(day);
			}
		}
	}

	const deptToGroup = new Map<number, string>();
	for (const g of groups) for (const d of g.departments) deptToGroup.set(d.departmentId, g.name);

	const defaultGroup = 'Другое';

	const monthNames = [
		'Январь',
		'Февраль',
		'Март',
		'Апрель',
		'Май',
		'Июнь',
		'Июль',
		'Август',
		'Сентябрь',
		'Октябрь',
		'Ноябрь',
		'Декабрь'
	];
	const dateLabel = `${monthNames[month - 1]} ${year} г.`;

	const half1 = Math.min(15, lastDay);

	// Карта: groupName → { ws, row }
	const sheets = new Map<string, { ws: Excel.Worksheet; row: number }>();

	for (const dept of departments) {
		const groupName = deptToGroup.get(dept.id ?? dept.departmentId) ?? defaultGroup;

		if (!sheets.has(groupName)) {
			const ws = wb.addWorksheet(groupName, {
				pageSetup: {
					orientation: 'landscape',
					paperSize: 9,
					margins: { top: 1, bottom: 1, left: 0.5, right: 0.5, header: 0, footer: 0 }
				}
			});
			setColWidths(ws);
			sheets.set(groupName, { ws, row: 1 });
		}

		const sheet = sheets.get(groupName)!;

		// Если есть сотрудники — пишем шапку подразделения
		if (dept.employees?.length) {
			onProgress?.(dept.name, `${dept.employees.length} сотрудников`);

			// Полная шапка с названием подразделения (как Python _construct_header)
			sheet.row = writeDivisionHeader(sheet.ws, sheet.row, dept.name, dateLabel, lastDay, half1);

			let empIndex = 0;
			for (const emp of dept.employees) {
				empIndex++;
				const rounding: RoundingConfig | null = roundingConfig
					? { ...roundingConfig, scheduleStandardTime: emp.schedule?.standardWorkTime ?? null }
					: null;

				sheet.row = writeEmployee(
					sheet.ws,
					sheet.row,
					buildEmpRow(emp, calendarDays, shiftMarkCodes, markByCodeObj),
					lastDay,
					half1,
					markByCodeObj,
					holidays ?? new Set(),
					rounding,
					empIndex,
					workDayIndices
				);

				// Каждые 9 сотрудников — разрыв страницы и повтор шапки
				if (empIndex % 9 === 0 && empIndex < dept.employees.length) {
					sheet.row = writeBottomHeader(sheet.ws, sheet.row);
					sheet.row = writeDivisionHeader(
						sheet.ws,
						sheet.row,
						dept.name,
						dateLabel,
						lastDay,
						half1
					);
				}
			}

			// Добиваем до кратности 9 (как в Python: while fmod(index, 9) != 0)
			while (empIndex % 9 !== 0) {
				empIndex++;
				sheet.row = writeEmployee(
					sheet.ws,
					sheet.row,
					null,
					lastDay,
					half1,
					markByCodeObj,
					new Set(),
					null,
					empIndex,
					new Set()
				);
			}

			// Bottom header после каждого подразделения
			sheet.row = writeBottomHeader(sheet.ws, sheet.row);
		}
	}

	return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

function buildEmpRow(
	emp: any,
	calendarDays?: Record<string, { dayType: string; workTime: number | null }>,
	shiftMarkCodes?: Set<string>,
	markByCodeObj?: Map<string, any>
): EmployeeRow {
	const stdMinutes = emp.schedule?.standardWorkTime ?? 0;

	let totalMinutes = 0;
	let nightMinutes = 0;
	let overtimeMinutes = 0;
	let weekendHolidayMinutes = 0;

	const builtDays: DayData[] = [];

	for (const d of emp.days) {
		const workTime = d.reportWorkTime ?? d.shiftWorkTime ?? null;
		const nightTime = d.reportNightWorkTime ?? d.shiftNightWorkTime ?? null;
		const markCode = d.dayMarkCode ?? '';

		builtDays.push({
			date: d.date,
			dayMarkCode: markCode,
			reportWorkTime: workTime,
			reportNightWorkTime: nightTime
		});

		if (workTime == null) continue;

		totalMinutes += workTime;
		nightMinutes += nightTime ?? 0;

		// Определяем тип дня по календарю
		const cal = calendarDays?.[d.date];
		const dayType = cal?.dayType ?? 'workday';
		const isWeekendOrHoliday =
			dayType === 'holiday' || dayType === 'weekend' || dayType === 'transferred_holiday';

		// Выходные/праздничные часы
		if (isWeekendOrHoliday) {
			weekendHolidayMinutes += workTime;
		}

		// Сверхурочные: на workday если отработано больше стандарта
		if (!isWeekendOrHoliday && stdMinutes > 0 && workTime > stdMinutes) {
			overtimeMinutes += workTime - stdMinutes;
		}
	}

	return {
		number: emp.number,
		fullName: `${emp.lastName} ${emp.firstName} ${emp.middleName ?? ''}`.trim(),
		position: emp.positionName ?? '',
		days: builtDays,
		totalHours: Math.round((totalMinutes / 60) * 10) / 10,
		nightHours: Math.round((nightMinutes / 60) * 10) / 10,
		overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
		weekendHolidayHours: Math.round((weekendHolidayMinutes / 60) * 10) / 10
	};
}

function setColWidths(ws: Excel.Worksheet) {
	for (const [key, width] of COL_WIDTHS) {
		if (Array.isArray(key)) {
			for (let c = key[0]; c <= key[1]; c++) ws.getColumn(c).width = width;
		} else {
			ws.getColumn(key).width = width;
		}
	}
}

function setRowHeights(ws: Excel.Worksheet, row: number) {
	for (const [key, height] of HEADER_HEIGHTS) {
		if (Array.isArray(key)) {
			for (let r = key[0]; r <= key[1]; r++) ws.getRow(row + r).height = height;
		} else {
			ws.getRow(row + key).height = height;
		}
	}
}

/**
 * Полная шапка подразделения: как Python _construct_header
 * Пишет "2-я страница формы Т-12", заголовок, участок, дату,
 * заголовки колонок и номера колонок
 */
function writeDivisionHeader(
	ws: Excel.Worksheet,
	row: number,
	deptName: string,
	dateLabel: string,
	lastDay: number,
	half1: number
): number {
	// Часть 1: заголовок (writeHeaderSection с именем подразделения)
	setRowHeights(ws, row);

	ws.mergeCells(row, 44, row, 46);
	cell(
		ws,
		row,
		44,
		'2-\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u0444\u043e\u0440\u043c\u044b \u0422-12',
		{ name: 'Times New Roman', size: 8 },
		{ horizontal: 'right', vertical: 'bottom' }
	);

	row++;
	ws.mergeCells(row, 1, row, 4);
	cell(
		ws,
		row,
		1,
		'1. \u0423\u0447\u0435\u0442 \u0440\u0430\u0431\u043e\u0447\u0435\u0433\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438',
		{ name: 'Times New Roman', size: 12, bold: true },
		ALIGN_CENTER
	);

	ws.mergeCells(row, 5, row, 8);
	cell(
		ws,
		row,
		5,
		'\u0423\u0447\u0430\u0441\u0442\u043e\u043a',
		{ name: 'Times New Roman', size: 12, bold: true },
		{ horizontal: 'right', vertical: 'bottom' }
	);

	ws.mergeCells(row, 9, row, 18);
	cell(ws, row, 9, deptName, { name: 'Times New Roman', size: 12, bold: true }, ALIGN_CENTER, {
		bottom: { style: 'medium' }
	});

	ws.mergeCells(row, 26, row, 36);
	cell(ws, row, 26, dateLabel, { name: 'Times New Roman', size: 12, bold: true }, ALIGN_CENTER);

	row += 2;

	// Часть 2: заголовки колонок (writeColHeaders)
	row = writeColHeaders(ws, row, lastDay, half1);

	// Часть 3: номера колонок (writeColNumbers)
	row = writeColNumbers(ws, row, lastDay, half1);

	return row + 1;
}

function writeColHeaders(ws: Excel.Worksheet, row: number, lastDay: number, half1: number): number {
	let c = 1;
	ws.mergeCells(row, c, row + 3, c);
	cell(ws, row, c, 'Номер по порядку', FONT, ALIGN_CENTER, BORDER);
	c++;
	ws.mergeCells(row, c, row + 3, c);
	cell(
		ws,
		row,
		c,
		'Фамилия, инициалы, должность (специальность, профессия)',
		FONT,
		ALIGN_CENTER,
		BORDER
	);
	c++;
	ws.mergeCells(row, c, row + 3, c);
	cell(ws, row, c, 'Табельный\nномер', FONT, ALIGN_CENTER, BORDER);
	c++;

	const markStart = c;
	// Заголовок "Отметки о явках..." — мержим все колонки дней (первая + вторая половина + итоги половин)
	const markMergeEnd = lastDay > 15 ? 36 : 4 + half1 - 1;
	ws.mergeCells(row, c, row, markMergeEnd);
	cell(
		ws,
		row,
		c,
		'Отметки о явках и неявках на работу по числам месяца',
		FONT,
		ALIGN_CENTER,
		BORDER
	);
	row++;

	for (let d = 1; d <= half1; d++) {
		ws.mergeCells(row, markStart + d - 1, row + 2, markStart + d - 1);
		cell(ws, row, markStart + d - 1, d, { name: 'Times New Roman', size: 7 }, ALIGN_CENTER, BORDER);
	}

	let col = markStart + half1;

	if (lastDay > 15) {
		ws.mergeCells(row, col, row + 2, col);
		cell(ws, row, col, 'Итого за I половину', FONT, ALIGN_CENTER, BORDER);
		col++;
		for (let d = 16; d <= lastDay; d++) {
			ws.mergeCells(row, col, row + 2, col);
			cell(ws, row, col, d, { name: 'Times New Roman', size: 7 }, ALIGN_CENTER, BORDER);
			col++;
		}
		ws.mergeCells(row, col, row + 2, col);
		cell(ws, row, col, 'Итого за II половину', FONT, ALIGN_CENTER, BORDER);
		col++;
	}

	// Итого за месяц
	ws.mergeCells(row - 1, col, row - 1, col + 5);
	cell(ws, row - 1, col, 'Итого отработано за месяц', FONT, ALIGN_CENTER, BORDER);
	ws.mergeCells(row, col, row + 2, col);
	cell(ws, row, col, 'дней', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	ws.mergeCells(row, col, row, col + 4);
	cell(ws, row, col, 'часов', FONT, ALIGN_CENTER, BORDER);
	row++;
	ws.mergeCells(row, col, row + 1, col);
	cell(ws, row, col, 'всего', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	ws.mergeCells(row, col, row, col + 3);
	cell(ws, row, col, 'из них', FONT, ALIGN_CENTER, BORDER);
	row++;
	cell(ws, row, col, 'сверхурочных', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	cell(ws, row, col, 'ночных', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	cell(ws, row, col, 'выходных,\nпраздничных', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	cell(ws, row, col, '', FONT, ALIGN_CENTER, BORDER);
	col++;
	row -= 3;

	// Неявки
	ws.mergeCells(row, col, row + 3, col);
	cell(
		ws,
		row,
		col,
		'Количество неявок,\nдней (часов)',
		FONT,
		{ ...ALIGN_CENTER, vertical: 'top' },
		BORDER
	);
	col++;
	ws.mergeCells(row, col, row, col + 1);
	cell(ws, row, col, 'Из них по причинам', FONT, ALIGN_CENTER, BORDER);
	row++;
	ws.mergeCells(row, col, row + 2, col);
	cell(ws, row, col, 'код', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	ws.mergeCells(row, col, row + 2, col);
	cell(
		ws,
		row,
		col,
		'количество\nдней (часов)',
		FONT,
		{ ...ALIGN_CENTER, vertical: 'top' },
		BORDER
	);
	col++;
	row--;
	ws.mergeCells(row, col, row + 3, col);
	cell(
		ws,
		row,
		col,
		'Количество выходных\nи праздничных дней',
		FONT,
		{ ...ALIGN_CENTER, vertical: 'top' },
		BORDER
	);

	return row + 4;
}

function writeColNumbers(ws: Excel.Worksheet, row: number, lastDay: number, half1: number): number {
	let c = 1;
	for (let i = 1; i <= 3; i++) {
		cell(ws, row, c, i, E_FONT, ALIGN_CENTER, BORDER);
		c++;
	}
	cell(ws, row, c, 4, E_FONT, ALIGN_CENTER, BORDER);
	ws.mergeCells(row, c, row, c + half1 - 1);
	c += half1;
	if (lastDay > 15) {
		cell(ws, row, c, 5, E_FONT, ALIGN_CENTER, BORDER);
		c++;
		cell(ws, row, c, 6, E_FONT, ALIGN_CENTER, BORDER);
		ws.mergeCells(row, c, row, c + lastDay - 16);
		c += lastDay - 15;
	}
	let idx = 7;
	while (c <= 46) {
		cell(ws, row, c, idx, E_FONT, ALIGN_CENTER, BORDER);
		idx++;
		c++;
	}
	return row;
}

function writeEmployee(
	ws: Excel.Worksheet,
	row: number,
	emp: EmployeeRow | null,
	lastDay: number,
	half1: number,
	markByCode: Map<string, any>,
	holidays: Set<number>,
	rounding: RoundingConfig | null,
	empIndex: number,
	workDayIndices: Set<number>
): number {
	const hr = row + 1;
	const d = emp?.days ?? [];

	// helper: merge 2 rows, then set value + style
	function mc(c: number, v: any, f: any, a: any, b: any) {
		ws.mergeCells(row, c, hr, c);
		const cl = ws.getCell(row, c);
		setCellValue(cl, v);
		cl.font = f;
		cl.alignment = a;
		if (b) cl.border = b;
	}
	function dc(c: number, mark: string, hoursVal: any) {
		cell(ws, row, c, mark, { name: 'Times New Roman', size: 8 }, ALIGN_CENTER, {
			top: BORDER.top,
			bottom: BORDER.bottom,
			left: BORDER.left,
			right: BORDER.right
		});
		cell(ws, hr, c, hoursVal, { name: 'Times New Roman', size: 8 }, ALIGN_CENTER, {
			top: BORDER.top,
			bottom: { style: 'medium' },
			left: BORDER.left,
			right: BORDER.right
		});
	}

	if (emp) {
		mc(1, empIndex, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		mc(
			2,
			`${emp.fullName},\n${emp.position}`,
			EMP_FONT,
			{ horizontal: 'left', vertical: 'middle', wrapText: true },
			EMP_BORDER
		);
		mc(3, emp.number, EMP_FONT, ALIGN_CENTER, EMP_BORDER);

		// Дни 1-15 (col 4-18)
		const half1End = Math.min(15, lastDay);
		let c = 4;
		for (let dayIdx = 0; dayIdx < half1End; dayIdx++) {
			const day = d[dayIdx] ?? null;
			const dayOfMonth = dayIdx + 1;
			const mark = day?.dayMarkCode ?? '';
			const markObj = mark ? markByCode.get(mark) : null;
			const isWorkMark = markObj?.category === 'work';
			const isHoliday = isWorkMark && holidays.has(dayOfMonth);
			const hoursVal =
				day?.reportWorkTime != null
					? roundWorkTime(day.reportWorkTime, rounding, isHoliday ? 1 : 0)
					: '';
			dc(c, mark, hoursVal);
			c++;
		}

		// Итого I половина (col 19)
		mc(
			c,
			`=SUM(D${hr}:${getColumnLetter(4 + half1End - 1)}${hr})`,
			EMP_FONT,
			ALIGN_CENTER,
			EMP_BORDER
		);
		c++;

		// Дни 16-31 (col 20-35)
		if (lastDay > 15) {
			for (let dayIdx = 15; dayIdx < lastDay; dayIdx++) {
				const day = d[dayIdx] ?? null;
				const dayOfMonth = dayIdx + 1;
				const mark = day?.dayMarkCode ?? '';
				const markObj = mark ? markByCode.get(mark) : null;
				const isWorkMark = markObj?.category === 'work';
				const isHoliday = isWorkMark && holidays.has(dayOfMonth);
				const hoursVal =
					day?.reportWorkTime != null
						? roundWorkTime(day.reportWorkTime, rounding, isHoliday ? 1 : 0)
						: '';
				dc(c, mark, hoursVal);
				c++;
			}
		}

		// Итого II половина (col 36)
		if (lastDay > 15) {
			mc(
				c,
				`=SUM(T${hr}:${getColumnLetter(20 + lastDay - 16)}${hr})`,
				EMP_FONT,
				ALIGN_CENTER,
				EMP_BORDER
			);
			c++;
		} else {
			mc(c, '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
			c++;
		}

		// days count (col 37)
		mc(
			c,
			`=COUNT(D${hr}:${getColumnLetter(4 + half1End - 1)}${hr})+COUNT(T${hr}:${getColumnLetter(20 + Math.max(0, lastDay - 16))}${hr})`,
			EMP_FONT,
			ALIGN_CENTER,
			EMP_BORDER
		);
		c++;

		// total hours (col 38) = S19 + S36
		mc(
			c,
			`=${getColumnLetter(19)}${row}+${getColumnLetter(36)}${row}`,
			EMP_FONT,
			ALIGN_CENTER,
			EMP_BORDER
		);
		c++;

		// сверхурочных (col 39)
		mc(c, emp.overtimeHours || '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// ночных (col 40)
		mc(c, emp.nightHours || '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// выходных/праздничных (col 41)
		mc(c, emp.weekendHolidayHours || '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// пусто (col 42)
		mc(c, '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// Собираем неявки + прогулы
		const skippedDays: Map<string, { cnt: number; hours: number; cols: number[] }> = new Map();
		for (let dayIdx = 0; dayIdx < lastDay; dayIdx++) {
			const day = d[dayIdx];
			const dayOfMonth = dayIdx + 1;

			if (!day?.dayMarkCode) {
				// Пустой код на рабочий день — прогул
				if (workDayIndices.has(dayOfMonth)) {
					if (!skippedDays.has('ПР')) skippedDays.set('ПР', { cnt: 0, hours: 0, cols: [] });
					const sd = skippedDays.get('ПР')!;
					sd.cnt++;
					sd.cols.push(dayIdx < 15 ? 4 + dayIdx : 20 + (dayIdx - 15));
				}
				continue;
			}
			const markObj = markByCode.get(day.dayMarkCode);
			const reportCode = markObj?.reportCode;
			if (reportCode) {
				if (!skippedDays.has(reportCode))
					skippedDays.set(reportCode, { cnt: 0, hours: 0, cols: [] });
				const sd = skippedDays.get(reportCode)!;
				sd.cnt++;
				sd.hours += day.reportWorkTime ?? 0;
				sd.cols.push(dayIdx < 15 ? 4 + dayIdx : 20 + (dayIdx - 15));
			}
		}

		// неявки кол-во (col 43) – COUNTA по колонкам дней с неявками
		if (skippedDays.size > 0) {
			const allRefs: string[] = [];
			for (const [, sd] of skippedDays) {
				for (const colNum of sd.cols) {
					allRefs.push(`${getColumnLetter(colNum)}${row}`);
				}
			}
			mc(c, `=COUNTA(${allRefs.join(',')})`, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		} else {
			mc(c, '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		}
		c++;

		// коды неявок (col 44)
		const codes = [...skippedDays.keys()].join('\n');
		mc(c, codes, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// часы неявок (col 45) – как в Python: COUNTA(cells)*StandartWorkTime с CHAR(10)
		if (skippedDays.size > 0) {
			const stdHours =
				rounding?.scheduleStandardTime != null
					? Math.round((rounding.scheduleStandardTime / 60) * 10) / 10
					: 8;
			// Формула как в Python: =(COUNTA(E4)*8) & CHAR(10) & (COUNTA(U4)*8)
			let formula = '=';
			for (const [, sd] of skippedDays) {
				// Ссылки на верхнюю строку (с отметками), как в Python
				const refs = sd.cols.map((colNum) => `${getColumnLetter(colNum)}${row}`).join(',');
				formula += `(COUNTA(${refs})*${stdHours}) & CHAR(10) & `;
			}
			// Убираем последний ' & CHAR(10) & ' (13 символов)
			formula = formula.slice(0, -13);
			mc(c, formula, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		} else {
			mc(c, '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		}
		c++;

		// пусто (col 46)
		mc(c, '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
	} else {
		// Пустой сотрудник — со сквозным номером
		for (let c = 1; c <= 46; c++) {
			if (c === 1) {
				mc(c, empIndex, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
			} else {
				const align =
					c === 2 ? { horizontal: 'left', vertical: 'middle', wrapText: true } : ALIGN_CENTER;
				mc(c, '', EMP_FONT, align, EMP_BORDER);
			}
		}
	}

	ws.getRow(row).height = ROW_HEIGHT;
	ws.getRow(hr).height = ROW_HEIGHT;
	return row + 2;
}

function writeBottomHeader(ws: Excel.Worksheet, row: number): number {
	(ws as any).rowBreaks.push({ id: row, max: 16383, min: 0, man: true });
	return row + 1;
}

function setCellValue(cl: any, value: any) {
	if (typeof value === 'string' && value.startsWith('=')) {
		cl.value = { formula: value.substring(1) };
	} else {
		cl.value = value;
	}
}

function cell(
	ws: Excel.Worksheet,
	r: number,
	c: number,
	value: any,
	font: any,
	alignment: any,
	border?: any
) {
	const cl = ws.getCell(r, c);
	setCellValue(cl, value);
	cl.font = font;
	cl.alignment = alignment;
	if (border) cl.border = border;
}

function getColumnLetter(col: number): string {
	let letter = '';
	while (col > 0) {
		const mod = (col - 1) % 26;
		letter = String.fromCharCode(65 + mod) + letter;
		col = Math.floor((col - 1) / 26);
	}
	return letter;
}
