import type { hrDocument } from '../tables/document';

export type DocSegment = {
	departmentId: number | null;
	departmentName: string | null;
	positionId: number | null;
	positionName: string | null;
	dateFrom: string;
	dateTo: string;
};

function clamp(date: string, min: string, max: string): string {
	if (date < min) return min;
	if (date > max) return max;
	return date;
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

		// Сегмент ПЕРЕД текущим документом (использует отдел предыдущего документа)
		if (prevDoc) {
			const segFrom = clamp(addDays(prevDoc.date, 1), monthStart, monthEnd);
			// Для всех типов документов: сегмент заканчивается ДО даты документа
			const segTo = clamp(addDays(doc.date, -1), monthStart, monthEnd);

			if (segTo >= segFrom) {
				const dept = prevDoc.departmentId ? deptById.get(prevDoc.departmentId) : undefined;
				const pos = prevDoc.positionId ? posById.get(prevDoc.positionId) : undefined;
				segments.push({
					departmentId: prevDoc.departmentId ?? null,
					departmentName: dept?.name ?? null,
					positionId: prevDoc.positionId ?? null,
					positionName: pos?.name ?? null,
					dateFrom: segFrom,
					dateTo: segTo
				});
			}
		}

		// Сегмент С текущего документа (использует отдел этого документа)
		// Для увольнения — не создаём, сотрудник уволен с этой даты
		if (doc.type !== 'dismissal') {
			const segFrom = clamp(prevDoc ? doc.date : monthStart, monthStart, monthEnd);
			const segTo = clamp(doc.date, monthStart, monthEnd);

			if (segTo >= segFrom) {
				const dept = doc.departmentId ? deptById.get(doc.departmentId) : undefined;
				const pos = doc.positionId ? posById.get(doc.positionId) : undefined;
				segments.push({
					departmentId: doc.departmentId ?? null,
					departmentName: dept?.name ?? null,
					positionId: doc.positionId ?? null,
					positionName: pos?.name ?? null,
					dateFrom: segFrom,
					dateTo: segTo
				});
			}
		}

		prevDoc = doc;
	}

	// Последний сегмент — от последнего документа до конца месяца
	if (prevDoc && prevDoc.type !== 'dismissal') {
		const lastFrom = clamp(addDays(prevDoc.date, 1), monthStart, monthEnd);
		const lastSeg = segments[segments.length - 1];
		if (lastFrom <= monthEnd && (!lastSeg || lastFrom > lastSeg.dateTo)) {
			const dept = prevDoc.departmentId ? deptById.get(prevDoc.departmentId) : undefined;
			const pos = prevDoc.positionId ? posById.get(prevDoc.positionId) : undefined;
			segments.push({
				departmentId: prevDoc.departmentId ?? null,
				departmentName: dept?.name ?? null,
				positionId: prevDoc.positionId ?? null,
				positionName: pos?.name ?? null,
				dateFrom: lastFrom,
				dateTo: monthEnd
			});
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

	if (segments.length === 0) {
		segments.push({
			departmentId: null,
			departmentName: null,
			positionId: null,
			positionName: null,
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
