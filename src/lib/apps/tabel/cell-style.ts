/**
 * Расчёт инлайн-стиля ячейки табеля (переработка/недоработка, пропуски,
 * спец-цвета отметок и т.д.). Используется и при SSR-рендере нативной
 * страницы, и на сервере (marks/+server.ts) для динамической расцветки.
 */

export type CellStyleCtx = {
	shiftMarks: string[];
	calendarDays: Record<string, { dayType: string; workTime: number | null }>;
	schedulesById: Record<number, { standardWorkTime: number }>;
	cellColorRules: Record<string, any>;
	markColorRules: Record<string, any>;
};

export function cellStyle(day: any, schedule: any, ctx: CellStyleCtx): string {
	if (!day) return '';
	if (day.blocked) return '';

	const { shiftMarks, calendarDays, schedulesById, cellColorRules, markColorRules } = ctx;

	const isShift =
		shiftMarks.includes(day.dayMarkCode) || day.dayMarkCode === 'I' || day.dayMarkCode === 'N';
	// Отчётные часы приоритетны; если табельщик их ещё не проставил — берём сменные из импорта
	const workMinutes = day.reportWorkTime ?? day.shiftWorkTime;
	const hasHours = workMinutes != null;
	const calDay = calendarDays[day.date];

	const styles: string[] = [];

	// Спец-цвет для отметки
	const markRule = markColorRules[day.dayMarkCode];
	if (markRule) {
		if (markRule.bg) styles.push(`background-color:${markRule.bg}`);
		if (markRule.color) styles.push(`color:${markRule.color}`);
		if (markRule.fontWeight) styles.push(`font-weight:${markRule.fontWeight}`);
	}

	const expectedMinutes = (() => {
		if (day.scheduleId && schedulesById[day.scheduleId]) {
			return schedulesById[day.scheduleId].standardWorkTime;
		}
		if (workMinutes && !day.scheduleId) {
			const matched = Object.values(schedulesById).find(
				(s: any) => s.standardWorkTime === workMinutes
			);
			if (matched) return matched.standardWorkTime;
		}
		return calDay?.workTime ?? schedule?.standardWorkTime;
	})();

	// Сменная отметка без часов
	if (isShift && !hasHours && cellColorRules.missingHours?.bg) {
		styles.push(`background-color:${cellColorRules.missingHours.bg}`);
		return styles.join(';');
	}

	// Переработка / недоработка (допуск 3 мин)
	if (isShift && hasHours && expectedMinutes) {
		const diff = Math.abs(workMinutes - expectedMinutes);
		if (diff > 3) {
			if (workMinutes > expectedMinutes && cellColorRules.overwork?.bg) {
				styles.push(`background-color:${cellColorRules.overwork.bg}`);
				return styles.join(';');
			}
			if (workMinutes < expectedMinutes && cellColorRules.underwork?.bg) {
				styles.push(`background-color:${cellColorRules.underwork.bg}`);
				return styles.join(';');
			}
		}
	}

	// Работа в нерабочий день
	if (isShift && calDay) {
		const isNonWorkDay = calDay.dayType === 'weekend' || calDay.dayType === 'holiday';
		if (isNonWorkDay && cellColorRules.weekendWork?.bg) {
			styles.push(`background-color:${cellColorRules.weekendWork.bg}`);
			return styles.join(';');
		}
	}

	if (isShift && !calDay && schedule?.weekDays) {
		const jsDay = new Date(day.date).getDay();
		const wdDay = jsDay === 0 ? 7 : jsDay;
		try {
			const workDays: number[] = JSON.parse(schedule.weekDays);
			if (!workDays.includes(wdDay) && cellColorRules.weekendWork?.bg) {
				styles.push(`background-color:${cellColorRules.weekendWork.bg}`);
				return styles.join(';');
			}
		} catch {}
	}

	// Пропущенный рабочий день
	if (!day.dayMarkCode && !hasHours) {
		if (calDay) {
			const isWorkDay =
				calDay.dayType === 'workday' ||
				calDay.dayType === 'preholiday' ||
				calDay.dayType === 'transferred_workday';
			if (isWorkDay && cellColorRules.missedWorkday?.bg) {
				styles.push(`background-color:${cellColorRules.missedWorkday.bg}`);
				return styles.join(';');
			}
		} else if (schedule?.weekDays) {
			const jsDay = new Date(day.date).getDay();
			const wdDay = jsDay === 0 ? 7 : jsDay;
			try {
				const workDays: number[] = JSON.parse(schedule.weekDays);
				if (workDays.includes(wdDay) && cellColorRules.missedWorkday?.bg) {
					styles.push(`background-color:${cellColorRules.missedWorkday.bg}`);
					return styles.join(';');
				}
			} catch {}
		}
	}

	return styles.join(';');
}
