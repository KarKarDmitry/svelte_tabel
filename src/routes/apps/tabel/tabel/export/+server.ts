import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { buildT12 } from '$lib/server/db/apps/tabel/reports/T-12_builder';
import { getControlledDepartmentIds } from '$lib/server/permissions';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { year, month } = await request.json();

	if (!year || !month) {
		return json({ error: 'year and month are required' }, { status: 400 });
	}

	const [data, groups] = await Promise.all([
		worktimeService.getMonthGrouped(year, month),
		departmentGroupService.listWithDepartments()
	]);

	// Не-админ экспортирует только подконтрольные подразделения
	const controlled = await getControlledDepartmentIds(locals.user);
	let departments = data.departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		departments = data.departments.filter((d: any) => set.has(d.id));
	}

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
		departments,
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
