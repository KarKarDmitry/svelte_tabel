import XlsxPopulate from 'xlsx-populate';

// --- Временный профилировщик (для замера узких мест buildT12) ---
const __prof = new Map<string, { count: number; ms: number }>();
function time<T>(name: string, fn: () => T): T {
	const t0 = performance.now();
	try {
		return fn();
	} finally {
		const d = performance.now() - t0;
		const e = __prof.get(name);
		if (e) {
			e.count++;
			e.ms += d;
		} else {
			__prof.set(name, { count: 1, ms: d });
		}
	}
}
function printProfileSummary() {
	const rows = [...__prof.entries()]
		.map(([name, v]) => ({ name, count: v.count, ms: Math.round(v.ms * 10) / 10 }))
		.sort((a, b) => b.ms - a.ms);
	console.log('\n=== ПРОФИЛЬ buildT12 (xlsx-populate) ===');
	console.table(rows);
}

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
	roundingPoint: number | null;
	roundingFrom: number | null;
	roundingTo: number | null;
	standardLeft: number;
	standardRight: number;
	scheduleStandardTime: number | null;
}

export interface ExportOptions {
	showNight?: boolean;
	showOvertime?: boolean;
	showHoliday?: boolean;
	showAbsence?: boolean;
	autoAbsence?: boolean;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
	showNight: true,
	showOvertime: false,
	showHoliday: true,
	showAbsence: true,
	autoAbsence: false
};

const FONT = { name: 'Times New Roman', size: 6 };
const E_FONT = { name: 'Times New Roman', size: 9 };
const EMP_FONT = { name: 'Times New Roman', size: 10 };
const BORDER = {
	top: { style: 'thin' },
	bottom: { style: 'thin' },
	left: { style: 'thin' },
	right: { style: 'thin' }
};
const EMP_BORDER = { ...BORDER, bottom: { style: 'medium' } };
const ALIGN_CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };

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

	if (
		rounding.roundingPoint == null &&
		rounding.roundingFrom == null &&
		rounding.roundingTo == null
	) {
		return Math.round(workHours);
	}

	let isRounded = false;
	let resultValue = workHours;

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

/* --- хелперы xlsx-populate --- */

function setCellValue(cell: any, value: any) {
	if (typeof value === 'string' && value.startsWith('=')) {
		cell.formula(value.substring(1));
	} else {
		cell.value(value);
	}
}

// xlsx-populate не понимает вложенные стили exceljs ({font:{...}, alignment:{...}}).
// Стили задаются плоскими ключами: fontFamily, fontSize, bold, horizontalAlignment, wrapText и т.д.
function toPopStyle(font: any, alignment: any, border?: any): any {
	const style: any = {};
	if (font) {
		if (font.name) style.fontFamily = font.name;
		if (font.size != null) style.fontSize = font.size;
		if (font.bold) style.bold = true;
		if (font.italic) style.italic = true;
		if (font.color) {
			const raw = typeof font.color === 'string' ? font.color : font.color.argb;
			if (raw) style.fontColor = raw.startsWith('#') ? raw : `#${raw}`;
		}
	}
	if (alignment) {
		if (alignment.horizontal) style.horizontalAlignment = alignment.horizontal;
		if (alignment.vertical) style.verticalAlignment = alignment.vertical;
		if (alignment.wrapText) style.wrapText = true;
	}
	if (border) style.border = border;
	return style;
}

// xlsx-populate не выставляет applyAlignment у xf — без этого флага Excel игнорирует выравнивание.
function applyCellStyle(cl: any, style: any) {
	if (Object.keys(style).length === 0) return;
	cl.style(style);
	if (style.horizontalAlignment || style.verticalAlignment || style.wrapText) {
		const xf = (cl._style as any)?._xfNode;
		if (xf?.attributes) xf.attributes.applyAlignment = 1;
	}
}

function applyRangeStyle(ws: any, r1: number, c1: number, r2: number, c2: number, style: any) {
	if (Object.keys(style).length === 0) return;
	const range = ws.range(r1, c1, r2, c2);
	range.style(style);
	if (style.horizontalAlignment || style.verticalAlignment || style.wrapText) {
		range.forEach((cl: any) => {
			const xf = (cl._style as any)?._xfNode;
			if (xf?.attributes) xf.attributes.applyAlignment = 1;
		});
	}
}

// merge + стиль на весь диапазон + значение в верхнюю-левую ячейку.
// Стиль применяем ко всем ячейкам диапазона, иначе в OOXML он виден только на top-left.
function mcell(
	ws: any,
	r1: number,
	c1: number,
	r2: number,
	c2: number,
	value: any,
	font: any,
	alignment: any,
	border?: any
) {
	merge(ws, r1, c1, r2, c2);
	const cl = ws.cell(r1, c1);
	const style = toPopStyle(font, alignment, border);
	time('mc:style', () => applyRangeStyle(ws, r1, c1, r2, c2, style));
	setCellValue(cl, value);
}

function cell(
	ws: any,
	r: number,
	c: number,
	value: any,
	font: any,
	alignment: any,
	border?: any
) {
	const cl = ws.cell(r, c);
	const style = toPopStyle(font, alignment, border);
	applyCellStyle(cl, style);
	setCellValue(cl, value);
}

function merge(ws: any, r1: number, c1: number, r2: number, c2: number) {
	time('merge', () => {
		ws.range(r1, c1, r2, c2).merged(true);
	});
}

function setColWidths(ws: any) {
	time('setColWidths', () => {
		for (const [key, width] of COL_WIDTHS) {
			if (Array.isArray(key)) {
				for (let c = key[0]; c <= key[1]; c++) ws.column(c).width(width);
			} else {
				ws.column(key).width(width);
			}
		}
	});
}

// xlsx-populate не имеет API для ориентации/размера страницы (pageSetup),
// поля страницы поддерживаются нативно, а узел pageSetup добавляем в XML вручную.
function setupPage(ws: any) {
	// Поля страницы (как в exceljs: top/bottom 1, left/right 0.5, header/footer 0)
	try {
		ws.pageMarginsPreset('normal');
		ws.pageMargins('top', 1)
			.pageMargins('bottom', 1)
			.pageMargins('left', 0.5)
			.pageMargins('right', 0.5)
			.pageMargins('header', 0)
			.pageMargins('footer', 0);
	} catch {
		// не критично
	}

	// Ориентация landscape + размер бумаги A4 (paperSize=9)
	try {
		const node = (ws as any)._node;
		if (!node?.children) return;

		const existingIdx = node.children.findIndex((ch: any) => ch?.name === 'pageSetup');
		if (existingIdx >= 0) node.children.splice(existingIdx, 1);

		const pageSetup = {
			name: 'pageSetup',
			attributes: { orientation: 'landscape', paperSize: 8 },
			children: []
		};

		// Вставляем по порядку OOXML: после pageMargins, перед headerFooter/rowBreaks/colBreaks
		const order = ['pageMargins', 'pageSetup', 'headerFooter', 'rowBreaks', 'colBreaks'];
		let insertAt = node.children.length;
		for (const name of order) {
			const i = node.children.findIndex((ch: any) => ch?.name === name);
			if (i >= 0) {
				insertAt = name === 'pageMargins' ? i + 1 : i;
				break;
			}
		}
		node.children.splice(insertAt, 0, pageSetup);
	} catch {
		// не критично
	}
}

function setRowHeights(ws: any, row: number) {
	time('setRowHeights', () => {
		for (const [key, height] of HEADER_HEIGHTS) {
			if (Array.isArray(key)) {
				for (let r = key[0]; r <= key[1]; r++) ws.row(row + r).height(height);
			} else {
				ws.row(row + key).height(height);
			}
		}
	});
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

/* --- заголовки --- */

function writeDivisionHeader(
	ws: any,
	row: number,
	deptName: string,
	dateLabel: string,
	lastDay: number,
	half1: number
): number {
	setRowHeights(ws, row);

	mcell(
		ws,
		row,
		44,
		row,
		46,
		'2-\u044f \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u0444\u043e\u0440\u043c\u044b \u0422-12',
		{ name: 'Times New Roman', size: 8 },
		{ horizontal: 'right', vertical: 'bottom' }
	);

	row++;
	mcell(
		ws,
		row,
		1,
		row,
		4,
		'1. \u0423\u0447\u0435\u0442 \u0440\u0430\u0431\u043e\u0447\u0435\u0433\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438',
		{ name: 'Times New Roman', size: 12, bold: true },
		ALIGN_CENTER
	);

	mcell(
		ws,
		row,
		5,
		row,
		8,
		'\u0423\u0447\u0430\u0441\u0442\u043e\u043a',
		{ name: 'Times New Roman', size: 12, bold: true },
		{ horizontal: 'right', vertical: 'bottom' }
	);

	mcell(ws, row, 9, row, 18, deptName, { name: 'Times New Roman', size: 12, bold: true }, ALIGN_CENTER, {
		bottom: { style: 'medium' }
	});

	mcell(ws, row, 26, row, 36, dateLabel, { name: 'Times New Roman', size: 12, bold: true }, ALIGN_CENTER);

	row += 2;

	row = writeColHeaders(ws, row, lastDay, half1);
	row = writeColNumbers(ws, row, lastDay, half1);

	return row + 1;
}

function writeColHeaders(ws: any, row: number, lastDay: number, half1: number): number {
	let c = 0;
	c++;
	mcell(ws, row, c, row + 3, c, 'Номер по порядку', FONT, ALIGN_CENTER, BORDER);
	c++;
	mcell(
		ws,
		row,
		c,
		row + 3,
		c,
		'Фамилия, инициалы, должность (специальность, профессия)',
		FONT,
		ALIGN_CENTER,
		BORDER
	);
	c++;
	mcell(ws, row, c, row + 3, c, 'Табельный\nномер', FONT, ALIGN_CENTER, BORDER);
	c++;

	const markStart = c;
	const markMergeEnd = 36;
	mcell(
		ws,
		row,
		c,
		row,
		markMergeEnd,
		'Отметки о явках и неявках на работу по числам месяца',
		FONT,
		ALIGN_CENTER,
		BORDER
	);
	row++;

	for (let d = 1; d <= half1; d++) {
		mcell(
			ws,
			row,
			markStart + d - 1,
			row + 2,
			markStart + d - 1,
			d,
			{ name: 'Times New Roman', size: 7 },
			ALIGN_CENTER,
			BORDER
		);
	}

	let col = markStart + half1;

	if (lastDay > 15) {
		mcell(ws, row, col, row + 2, col, 'Итого за I половину', FONT, ALIGN_CENTER, BORDER);
		col++;
		for (let d = 16; d <= 31; d++) {
			mcell(ws, row, col, row + 2, col, d, { name: 'Times New Roman', size: 7 }, ALIGN_CENTER, BORDER);
			col++;
		}
		mcell(ws, row, col, row + 2, col, 'Итого за II половину', FONT, ALIGN_CENTER, BORDER);
		col++;
	}

	// Итого за месяц
	mcell(ws, row - 1, col, row - 1, col + 5, 'Итого отработано за месяц', FONT, ALIGN_CENTER, BORDER);
	mcell(ws, row, col, row + 2, col, 'дней', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	mcell(ws, row, col, row, col + 4, 'часов', FONT, ALIGN_CENTER, BORDER);
	row++;
	mcell(ws, row, col, row + 1, col, 'всего', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	mcell(ws, row, col, row, col + 3, 'из них', FONT, ALIGN_CENTER, BORDER);
	row++;
	cell(ws, row, col, 'сверхурочных', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	cell(ws, row, col, 'ночных', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	cell(
		ws,
		row,
		col,
		'выходных,\nпраздничных',
		FONT,
		{ ...ALIGN_CENTER, vertical: 'top' },
		BORDER
	);
	col++;
	cell(ws, row, col, '', FONT, ALIGN_CENTER, BORDER);
	col++;
	row -= 3;

	// Неявки
	mcell(
		ws,
		row,
		col,
		row + 3,
		col,
		'Количество неявок,\nдней (часов)',
		FONT,
		{ ...ALIGN_CENTER, vertical: 'top' },
		BORDER
	);
	col++;
	mcell(ws, row, col, row, col + 1, 'Из них по причинам', FONT, ALIGN_CENTER, BORDER);
	row++;
	mcell(ws, row, col, row + 2, col, 'код', FONT, { ...ALIGN_CENTER, vertical: 'top' }, BORDER);
	col++;
	mcell(
		ws,
		row,
		col,
		row + 2,
		col,
		'количество\nдней (часов)',
		FONT,
		{ ...ALIGN_CENTER, vertical: 'top' },
		BORDER
	);
	col++;
	row--;
	mcell(
		ws,
		row,
		col,
		row + 3,
		col,
		'Количество выходных\nи праздничных дней',
		FONT,
		{ ...ALIGN_CENTER, vertical: 'top' },
		BORDER
	);

	return row + 4;
}

function writeColNumbers(ws: any, row: number, lastDay: number, half1: number): number {
	let c = 1;
	for (let i = 1; i <= 3; i++) {
		cell(ws, row, c, i, E_FONT, ALIGN_CENTER, BORDER);
		c++;
	}
	mcell(ws, row, c, row, c + 14, 4, E_FONT, ALIGN_CENTER, BORDER);
	c += 15;
	cell(ws, row, c, 5, E_FONT, ALIGN_CENTER, BORDER);
	c++;
	mcell(ws, row, c, row, c + 15, 6, E_FONT, ALIGN_CENTER, BORDER);
	c += 16;
	let idx = 7;
	while (c <= 46) {
		cell(ws, row, c, idx, E_FONT, ALIGN_CENTER, BORDER);
		idx++;
		c++;
	}
	return row;
}

/* --- сотрудник --- */

function writeEmployee(
	ws: any,
	row: number,
	emp: EmployeeRow | null,
	lastDay: number,
	half1: number,
	markByCode: Map<string, any>,
	holidays: Set<number>,
	rounding: RoundingConfig | null,
	empIndex: number,
	workDayIndices: Set<number>,
	shiftMarkCodes: Set<string>,
	options: ExportOptions
): number {
	const hr = row + 1;
	const d = emp?.days ?? [];

	function mc(c: number, v: any, f: any, a: any, b: any) {
		merge(ws, row, c, hr, c);
		const cl = ws.cell(row, c);
		const style = toPopStyle(f, a, b);
		time('mc:style', () => applyRangeStyle(ws, row, c, hr, c, style));
		setCellValue(cl, v);
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
			let displayMark = mark;
			let hoursVal: string | number | null = '';

			if (mark) {
				const isShift = shiftMarkCodes.has(mark);
				const isHoliday = isShift && holidays.has(dayOfMonth);
				hoursVal =
					isShift && day?.reportWorkTime != null
						? roundWorkTime(day.reportWorkTime, rounding, isHoliday ? 1 : 0)
						: '';
			} else if (options.autoAbsence && workDayIndices.has(dayOfMonth)) {
				displayMark = 'ПР';
			}
			dc(c, displayMark, hoursVal);
			c++;
		}

		while (c < 19) {
			dc(c, '-', '-');
			c++;
		}

		// Итого I половина (col 19)
		mc(c, `=SUM(D${hr}:${getColumnLetter(4 + half1End - 1)}${hr})`, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// Дни 16-31 (col 20-35)
		if (lastDay > 15) {
			for (let dayIdx = 15; dayIdx < 31; dayIdx++) {
				const day = d[dayIdx] ?? null;
				const dayOfMonth = dayIdx + 1;
				const mark = day?.dayMarkCode ?? '';
				let displayMark = mark;
				let hoursVal: string | number | null = '';

				if (mark) {
					const isShift = shiftMarkCodes.has(mark);
					const isHoliday = isShift && holidays.has(dayOfMonth);
					hoursVal =
						isShift && day?.reportWorkTime != null
							? roundWorkTime(day.reportWorkTime, rounding, isHoliday ? 1 : 0)
							: '';
				} else if (options.autoAbsence && workDayIndices.has(dayOfMonth)) {
					displayMark = 'ПР';
				}
				dc(c, displayMark, hoursVal);
				c++;
			}
		}

		// Итого II половина (col 36)
		if (lastDay > 15) {
			mc(c, `=SUM(T${hr}:${getColumnLetter(35)}${hr})`, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
			c++;
		} else {
			mc(c, '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
			c++;
		}

		// days count (col 37)
		mc(
			c,
			`=COUNT(D${hr}:${getColumnLetter(4 + half1End - 1)}${hr})+COUNT(T${hr}:${getColumnLetter(35)}${hr})`,
			EMP_FONT,
			ALIGN_CENTER,
			EMP_BORDER
		);
		c++;

		// total hours (col 38) = S19 + S36
		mc(c, `=${getColumnLetter(19)}${row}+${getColumnLetter(36)}${row}`, EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// сверхурочных (col 39)
		mc(c, (options.showOvertime ? emp.overtimeHours : '') || '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// ночных (col 40)
		mc(c, (options.showNight ? emp.nightHours : '') || '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// выходных/праздничных (col 41)
		mc(c, (options.showHoliday ? emp.weekendHolidayHours : '') || '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// пусто (col 42)
		mc(c, '', EMP_FONT, ALIGN_CENTER, EMP_BORDER);
		c++;

		// Собираем неявки + прогулы
		const skippedDays: Map<string, { cnt: number; hours: number; cols: number[] }> = new Map();
		if (options.showAbsence) {
			for (let dayIdx = 0; dayIdx < lastDay; dayIdx++) {
				const day = d[dayIdx];
				const dayOfMonth = dayIdx + 1;

				if (!day?.dayMarkCode) {
					if (options.autoAbsence && workDayIndices.has(dayOfMonth)) {
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
		}

		// неявки кол-во (col 43)
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

		// часы неявок (col 45)
		if (skippedDays.size > 0) {
			const stdHours =
				rounding?.scheduleStandardTime != null
					? Math.round((rounding.scheduleStandardTime / 60) * 10) / 10
					: 8;
			let formula = '=';
			for (const [, sd] of skippedDays) {
				const refs = sd.cols.map((colNum) => `${getColumnLetter(colNum)}${row}`).join(',');
				formula += `(COUNTA(${refs})*${stdHours}) & CHAR(10) & `;
			}
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

	ws.row(row).height(ROW_HEIGHT);
	ws.row(hr).height(ROW_HEIGHT);
	return row + 2;
}

function writeBottomHeader(ws: any, row: number): number {
	ws.horizontalPageBreaks().add(row);
	return row + 1;
}

/* --- сборка строки сотрудника (не зависит от Excel) --- */

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

		const cal = calendarDays?.[d.date];
		const dayType = cal?.dayType ?? 'workday';
		const isWeekendOrHoliday =
			dayType === 'holiday' || dayType === 'weekend' || dayType === 'transferred_holiday';

		if (isWeekendOrHoliday) {
			weekendHolidayMinutes += workTime;
		}

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

/* --- основной билдер --- */

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
	shiftMarkShortnames?: string[],
	options?: ExportOptions
): Promise<Buffer> {
	const opts: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };

	const markByCodeObj = new Map(dayMarks.map((m: any) => [m.code, m]));
	const markByShortObj = new Map(dayMarks.map((m: any) => [m.shortName, m]));

	const shiftMarkCodes = new Set<string>();
	if (shiftMarkShortnames) {
		for (const sn of shiftMarkShortnames) {
			const obj = markByShortObj.get(sn);
			if (obj) shiftMarkCodes.add(obj.code);
		}
	}

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
		'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
		'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
	];
	const dateLabel = `${monthNames[month - 1]} ${year} г.`;

	const half1 = Math.min(15, lastDay);

	const wb = await XlsxPopulate.fromBlankAsync();

	// Карта: groupName → { ws, row }
	const sheets = new Map<string, { ws: any; row: number }>();

	for (const dept of departments) {
		const groupName = deptToGroup.get(dept.id ?? dept.departmentId) ?? defaultGroup;

		if (!sheets.has(groupName)) {
			const ws = wb.addSheet(groupName);
			setupPage(ws);
			setColWidths(ws);
			sheets.set(groupName, { ws, row: 1 });
		}

		const sheet = sheets.get(groupName)!;

		// Если есть сотрудники — пишем шапку подразделения
		if (dept.employees?.length) {
			onProgress?.(`${dept.name} — ${dept.employees.length} сотрудников`, '');

			sheet.row = time('writeDivisionHeader', () =>
				writeDivisionHeader(sheet.ws, sheet.row, dept.name, dateLabel, lastDay, half1)
			);

			let empIndex = 0;
			for (const emp of dept.employees) {
				empIndex++;
				const fullName = `${emp.lastName ?? ''} ${emp.firstName ?? ''} ${emp.middleName ?? ''}`.trim();
				onProgress?.(dept.name, fullName);
				const rounding: RoundingConfig | null = roundingConfig
					? { ...roundingConfig, scheduleStandardTime: emp.schedule?.standardWorkTime ?? null }
					: null;

				sheet.row = time('writeEmployee', () =>
					writeEmployee(
						sheet.ws,
						sheet.row,
						time('buildEmpRow', () =>
							buildEmpRow(emp, calendarDays, shiftMarkCodes, markByCodeObj)
						),
						lastDay,
						half1,
						markByCodeObj,
						holidays ?? new Set(),
						rounding,
						empIndex,
						workDayIndices,
						shiftMarkCodes,
						opts
					)
				);

				// Даём event loop отправить прогресс (SSE)
				if (empIndex) {
					await new Promise((r) => setImmediate(r));
				}

				// Каждые 9 сотрудников — разрыв страницы и повтор шапки
				if (empIndex % 9 === 0 && empIndex < dept.employees.length) {
					sheet.row = writeBottomHeader(sheet.ws, sheet.row);
					sheet.row = time('writeDivisionHeader', () =>
						writeDivisionHeader(sheet.ws, sheet.row, dept.name, dateLabel, lastDay, half1)
					);
				}
			}

			// Добиваем до кратности 9
			while (empIndex % 9 !== 0) {
				empIndex++;
				sheet.row = time('writeEmployee', () =>
					writeEmployee(
						sheet.ws,
						sheet.row,
						null,
						lastDay,
						half1,
						markByCodeObj,
						holidays ?? new Set(),
						null,
						empIndex,
						workDayIndices,
						shiftMarkCodes,
						opts
					)
				);
			}

			// Bottom header после каждого подразделения
			sheet.row = writeBottomHeader(sheet.ws, sheet.row);
		}
	}

	// Убираем дефолтный пустой лист blank-воркбука (если не занят группой с таким именем)
	try {
		if (!sheets.has('Sheet1')) wb.deleteSheet('Sheet1');
	} catch {
		// если лист уже удалён
	}

	const buffer = await time('build:output', () => wb.outputAsync({ type: 'buffer' }));
	printProfileSummary();
	return buffer as Buffer;
}
