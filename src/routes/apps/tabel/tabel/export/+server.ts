import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { buildT12 } from '$lib/server/db/apps/tabel/reports/T-12_builder';

export const POST: RequestHandler = async ({ request }) => {
	const { year, month } = await request.json();

	if (!year || !month) {
		return json({ error: 'year and month are required' }, { status: 400 });
	}

	const [data, groups] = await Promise.all([
		worktimeService.getMonthGrouped(year, month, { pageSize: 9999 }),
		departmentGroupService.listWithDepartments()
	]);

	// Извлекаем праздничные дни месяца из calendarDays
	const holidays = new Set<number>();
	if (data.calendarDays) {
		for (const [dateStr, dayInfo] of Object.entries(data.calendarDays)) {
			if (dayInfo.dayType === 'holiday') {
				const day = parseInt(dateStr.split('-')[2], 10);
				holidays.add(day);
			}
		}
	}

	const buffer = await buildT12(
		groups,
		data.departments,
		data.dayMarks,
		year,
		month,
		data.lastDay,
		undefined,
		holidays,
		undefined,
		data.calendarDays,
		data.shiftMarks
	);

	const filename = `Табель_${year}_${String(month).padStart(2, '0')}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
