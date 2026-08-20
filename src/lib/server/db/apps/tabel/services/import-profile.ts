/* Локальный профайлер конвейера импорта (по образцу T-12_builder.ts).
   Метки между фазами; сводка по завершении — console.table + запись в лог импорта. */

import { log } from './import-logger';

type Mark = { name: string; t: number };

let marks: Mark[] = [];
let started = false;

/** Начать замеры (вызывается в начале импорта) */
export function profReset() {
	marks = [{ name: 'start', t: performance.now() }];
	started = true;
}

/** Отметить фазу */
export function profMark(name: string) {
	if (!started) return;
	marks.push({ name, t: performance.now() });
}

/** Разности между соседними метками, отсортированные по убыванию */
export function profSummary(): { phase: string; ms: number }[] {
	const rows: { phase: string; ms: number }[] = [];
	for (let i = 1; i < marks.length; i++) {
		rows.push({
			phase: `${marks[i - 1].name} → ${marks[i].name}`,
			ms: marks[i].t - marks[i - 1].t
		});
	}
	if (marks.length > 0) {
		rows.push({
			phase: `${marks[marks.length - 1].name} → end`,
			ms: performance.now() - marks[marks.length - 1].t
		});
	}
	return rows.sort((a, b) => b.ms - a.ms);
}

/** Вывести сводку (консоль + файл лога) и сбросить замеры */
export function profLog() {
	if (!started) return;
	started = false;
	const rows = profSummary();
	marks = [];
	if (rows.length === 0) return;
	console.table(rows);
	log('[profile]', JSON.stringify(rows.map((r) => `${r.phase}: ${r.ms.toFixed(1)}ms`)));
}
