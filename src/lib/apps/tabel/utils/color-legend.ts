/**
 * Легенда расцветки ячеек табеля. Цвета берутся из констант
 * app_constant (CELL_COLOR_RULES / MARK_COLOR_RULES), которые приходят
 * в page.data; здесь только человекочитаемые подписи и порядок.
 * Общий модуль для деревьев /apps и /native/apps.
 */

export type ColorLegendItem = {
	key: string;
	label: string;
	bg: string;
	fg?: string;
	bold?: boolean;
};

/** Порядок cell-правил по приоритету из cell-style.ts */
const CELL_ORDER = [
	'missingHours',
	'weekendWork',
	'overwork',
	'underwork',
	'missedWorkday'
] as const;

const CELL_LABELS: Record<string, string> = {
	missingHours: 'Сменная отметка без часов',
	weekendWork: 'Работа в выходной / праздник',
	overwork: 'Переработка (факт больше нормы дня)',
	underwork: 'Недоработка (факт меньше нормы дня)',
	missedWorkday: 'Пропущенный рабочий день'
};

type Mark = { code: string; shortName: string; name?: string | null };

/**
 * Собирает пункты легенды: сначала спец-цвета отметок, затем cell-правила.
 * `cell`/`mark` — уже выбранный по теме набор (light или dark).
 */
export function buildColorLegend(
	cell: Record<string, any> | null | undefined,
	mark: Record<string, any> | null | undefined,
	dayMarks: Mark[] | null | undefined
): ColorLegendItem[] {
	const items: ColorLegendItem[] = [];

	for (const key of CELL_ORDER) {
		const rule = cell?.[key];
		if (!rule?.bg) continue;
		items.push({ key, label: CELL_LABELS[key], bg: rule.bg });
	}

	for (const [code, rule] of Object.entries(mark ?? {})) {
		if (!rule?.bg) continue;
		const found = (dayMarks ?? []).find((m) => m.code === code);
		const fullName = found?.name?.trim();
		items.push({
			key: `mark:${code}`,
			label: fullName ? fullName : `Отметка «${found?.shortName ?? code}»`,
			bg: rule.bg,
			fg: rule.color,
			bold: rule.fontWeight === 'bold'
		});
	}

	return items;
}
