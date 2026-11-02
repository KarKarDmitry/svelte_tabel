import type { hrDocument } from '../tables/document';

export type DocSegment = {
	departmentId: number | null;
	departmentName: string | null;
	positionId: number | null;
	positionName: string | null;
	dateFrom: string;
	dateTo: string;
};

/**
 * Пересечение интервала [from, to] с месяцем.
 * null — если интервала нет или он целиком лежит вне месяца
 * (иначе clamp прижимал бы его к monthStart/monthEnd и создавал фантомный день).
 */
function intersect(
	from: string,
	to: string,
	monthStart: string,
	monthEnd: string
): { dateFrom: string; dateTo: string } | null {
	if (from > to) return null;
	if (to < monthStart || from > monthEnd) return null;
	return {
		dateFrom: from < monthStart ? monthStart : from,
		dateTo: to > monthEnd ? monthEnd : to
	};
}

export function buildEmployeeSegments(
	docs: (typeof hrDocument.$inferSelect)[],
	monthStart: string,
	monthEnd: string,
	deptById: Map<number, { name: string }>,
	posById: Map<number, { name: string }>
): DocSegment[] {
	if (docs.length === 0) {
		return [
			{
				departmentId: null,
				departmentName: null,
				positionId: null,
				positionName: null,
				dateFrom: monthStart,
				dateTo: monthEnd
			}
		];
	}

	// Если все документы до месяца — один сегмент по последнему действующему
	const lastActive = [...docs].reverse().find((d) => d.type !== 'dismissal');
	if (lastActive && docs[docs.length - 1].date < monthStart) {
		const dept = lastActive.departmentId ? deptById.get(lastActive.departmentId) : undefined;
		const pos = lastActive.positionId ? posById.get(lastActive.positionId) : undefined;
		return [
			{
				departmentId: lastActive.departmentId ?? null,
				departmentName: dept?.name ?? null,
				positionId: lastActive.positionId ?? null,
				positionName: pos?.name ?? null,
				dateFrom: monthStart,
				dateTo: monthEnd
			}
		];
	}

	const segments: DocSegment[] = [];
	let prevDoc: typeof hrDocument.$inferSelect | null = null;

	for (const doc of docs) {
		if (doc.date > monthEnd) continue;

		// Сегмент ПЕРЕД текущим документом (использует отдел предыдущего документа).
		// После увольнения сотрудник не работает — разрыв до следующего приёма,
		// иначе отдел из записи увольнения ошибочно продолжается.
		if (prevDoc && prevDoc.type !== 'dismissal') {
			// Для всех типов документов: сегмент заканчивается ДО даты документа
			const range = intersect(
				addDays(prevDoc.date, 1),
				addDays(doc.date, -1),
				monthStart,
				monthEnd
			);

			if (range) {
				const dept = prevDoc.departmentId ? deptById.get(prevDoc.departmentId) : undefined;
				const pos = prevDoc.positionId ? posById.get(prevDoc.positionId) : undefined;
				segments.push({
					departmentId: prevDoc.departmentId ?? null,
					departmentName: dept?.name ?? null,
					positionId: prevDoc.positionId ?? null,
					positionName: pos?.name ?? null,
					dateFrom: range.dateFrom,
					dateTo: range.dateTo
				});
			}
		}

		// Сегмент С текущего документа (использует отдел этого документа)
		// Для увольнения — не создаём, сотрудник уволен с этой даты
		if (doc.type !== 'dismissal') {
			const range = intersect(prevDoc ? doc.date : monthStart, doc.date, monthStart, monthEnd);

			if (range) {
				const dept = doc.departmentId ? deptById.get(doc.departmentId) : undefined;
				const pos = doc.positionId ? posById.get(doc.positionId) : undefined;
				segments.push({
					departmentId: doc.departmentId ?? null,
					departmentName: dept?.name ?? null,
					positionId: doc.positionId ?? null,
					positionName: pos?.name ?? null,
					dateFrom: range.dateFrom,
					dateTo: range.dateTo
				});
			}
		}

		prevDoc = doc;
	}

	// Последний сегмент — от последнего документа до конца месяца
	if (prevDoc && prevDoc.type !== 'dismissal') {
		const lastFrom = addDays(prevDoc.date, 1);
		const lastSeg = segments[segments.length - 1];
		if (!lastSeg || lastFrom > lastSeg.dateTo) {
			const range = intersect(lastFrom, monthEnd, monthStart, monthEnd);
			if (range) {
				const dept = prevDoc.departmentId ? deptById.get(prevDoc.departmentId) : undefined;
				const pos = prevDoc.positionId ? posById.get(prevDoc.positionId) : undefined;
				segments.push({
					departmentId: prevDoc.departmentId ?? null,
					departmentName: dept?.name ?? null,
					positionId: prevDoc.positionId ?? null,
					positionName: pos?.name ?? null,
					dateFrom: range.dateFrom,
					dateTo: range.dateTo
				});
			}
		}
	}

	// Сливаем смежные сегменты с одинаковым отделом
	if (segments.length > 1) {
		const merged: DocSegment[] = [segments[0]];
		for (let i = 1; i < segments.length; i++) {
			const prev = merged[merged.length - 1];
			const curr = segments[i];
			if (prev.departmentId === curr.departmentId && addDays(prev.dateTo, 1) >= curr.dateFrom) {
				prev.dateTo = curr.dateTo > prev.dateTo ? curr.dateTo : prev.dateTo;
			} else {
				merged.push(curr);
			}
		}
		// Заменяем на merged, только если это уменьшило количество сегментов
		if (merged.length < segments.length) {
			while (segments.length) segments.pop();
			for (const s of merged) segments.push(s);
		}
	}

	// Ни один активный период не пересекает месяц (например, увольнение 1-го числа,
	// но есть записи табеля). Показываем последний действующий отдел на весь месяц —
	// как в ветке «все документы до месяца», чтобы данные не уехали в «Без отдела».
	if (segments.length === 0) {
		const dept = lastActive?.departmentId ? deptById.get(lastActive.departmentId) : undefined;
		const pos = lastActive?.positionId ? posById.get(lastActive.positionId) : undefined;
		segments.push({
			departmentId: lastActive?.departmentId ?? null,
			departmentName: dept?.name ?? null,
			positionId: lastActive?.positionId ?? null,
			positionName: pos?.name ?? null,
			dateFrom: monthStart,
			dateTo: monthEnd
		});
	}

	return segments;
}

function addDays(dateStr: string, days: number): string {
	const d = new Date(dateStr);
	d.setDate(d.getDate() + days);
	return d.toISOString().split('T')[0];
}
