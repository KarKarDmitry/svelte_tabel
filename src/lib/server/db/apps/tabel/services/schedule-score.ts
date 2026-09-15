/* Чистое вычисление «лучшего графика» по паре вход/выход (scoring).
   Общий код для импорта турникетов (turnstile-import.service) и восстановления
   графика дня при экспорте Т-12 (правило 2 округления по стандарту).
   Модуль без I/O и без логов — только чистая математика. */

export type SchedulePointInput = {
	type: 'Entry' | 'Exit' | 'Break';
	time: string;
	endTime?: string | null;
	leftBound: number;
	rightBound: number;
};

/** Кандидат: график + его точки (Entry/Exit/Break) */
export type ScheduleCandidate = {
	scheduleId: number;
	points: SchedulePointInput[];
};

export type PickedSchedule = {
	scheduleId: number | null;
	score: number;
	/** Точки выбранного графика (Entry/Exit/Break) — для дальнейшего снаппинга в импорте */
	points: SchedulePointInput[];
};

/** "HH:MM" → минуты от полуночи */
function toMinutes(t: string): number {
	const p = t.split(':');
	const h = parseInt(p[0] ?? '0', 10);
	const m = parseInt(p[1] ?? '0', 10);
	return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * Оценка, насколько график (его точки) соответствует фактическому входу/выходу.
 * Логика повторяет Python determine_best_schedule:
 *  - Entry/Exit в границах плана → до +10 (убывает с отклонением)
 *  - Перерыв: смена покрывает перерыв +5; вход/выход в границах перерыва по +5
 */
export function scoreSchedule(
	points: SchedulePointInput[],
	enterMin: number,
	exitMin: number
): number {
	let score = 0;

	const ep = points.find((p) => p.type === 'Entry');
	const xp = points.find((p) => p.type === 'Exit');
	const bp = points.find((p) => p.type === 'Break');

	if (ep) {
		const planE = toMinutes(ep.time);
		const leftB = planE - ep.leftBound;
		const rightB = planE + ep.rightBound;
		if (enterMin >= leftB && enterMin <= rightB) {
			const diffSec = Math.abs(enterMin - planE) * 60;
			score += 10 - Math.min(10, diffSec / 300);
		}
	}

	if (xp) {
		const planX = toMinutes(xp.time);
		const leftB = planX - xp.leftBound;
		const rightB = planX + xp.rightBound;
		if (exitMin >= leftB && exitMin <= rightB) {
			const diffSec = Math.abs(exitMin - planX) * 60;
			score += 10 - Math.min(10, diffSec / 300);
		}
	}

	if (bp && bp.endTime) {
		const bkStart = toMinutes(bp.time);
		const bkEnd = toMinutes(bp.endTime);
		if (enterMin <= bkStart && exitMin >= bkEnd) {
			score += 5;
		}
		// Вход/выход в границах перерыва (с допуском)
		const breakLeft = bkStart - (bp.leftBound || 0);
		const breakRight = bkEnd + (bp.rightBound || 0);
		if (enterMin > breakLeft && enterMin < breakRight) {
			score += 5; // вход во время перерыва → возвращение с обеда
		}
		if (exitMin > breakLeft && exitMin < breakRight) {
			score += 5; // выход во время перерыва → уход на обед
		}
	}

	return score;
}

/**
 * Выбор лучшего графика среди кандидатов.
 * При равном скоре побеждает последний кандидат (как в импорте: кандидаты отсортированы
 * по scheduleId ASC, сравнение >= — т.е. при равенстве остаётся больший scheduleId).
 */
export function pickBestSchedule(
	candidates: ScheduleCandidate[],
	enterMin: number,
	exitMin: number
): PickedSchedule {
	let best: PickedSchedule = { scheduleId: null, score: 0, points: [] };
	for (const c of candidates) {
		const s = scoreSchedule(c.points, enterMin, exitMin);
		if (s >= best.score) {
			best = { scheduleId: c.scheduleId, score: s, points: c.points };
		}
	}
	return best;
}
