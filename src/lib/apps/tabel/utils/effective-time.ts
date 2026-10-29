/**
 * Эффективные часы дня табеля.
 *
 * Маркер `reportMarkCode === ''` означает явную очистку табельщиком:
 * часы/ночные пустые и НЕ подменяются сменными из импорта. Если оверрайда
 * нет (`reportMarkCode === null`), показываем отчётные часы, а при их
 * отсутствии — сменные из импорта.
 */
export function effectiveWorkMinutes(day: any): number | null {
	if (!day || day.reportMarkCode === '') return null;
	return day.reportWorkTime ?? day.shiftWorkTime ?? null;
}

export function effectiveNightMinutes(day: any): number | null {
	if (!day || day.reportMarkCode === '') return null;
	return day.reportNightWorkTime ?? day.shiftNightWorkTime ?? null;
}
