import type { RequestHandler } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { buildT12 } from '$lib/server/db/apps/tabel/reports/T-12_builder';

export const GET: RequestHandler = async ({ url }) => {
	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month'));

	if (!year || !month) {
		return new Response('Invalid params', { status: 400 });
	}

	const [data, groups] = await Promise.all([
		worktimeService.getMonthGrouped(year, month, { pageSize: 9999 }),
		departmentGroupService.listWithDepartments()
	]);

	// Считаем общее количество сотрудников
	const deptToGroup = new Map<number, string>();
	for (const g of groups) for (const d of g.departments) deptToGroup.set(d.departmentId, g.name);

	let totalEmployees = 0;
	for (const d of data.departments) {
		for (const emp of d.employees) {
			if (emp.days.some((day: any) => !day.blocked)) totalEmployees++;
		}
	}

	const stream = new ReadableStream({
		start(controller) {
			let current = 0;

			const emitter = (division: string, employee: string) => {
				current++;
				const msg = `data: ${JSON.stringify({ current, total: totalEmployees, division, employee })}\n\n`;
				controller.enqueue(new TextEncoder().encode(msg));
			};

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

			buildT12(
				groups,
				data.departments,
				data.dayMarks,
				year,
				month,
				data.lastDay,
				emitter,
				holidays,
				undefined,
				data.calendarDays,
				data.shiftMarks
			)
				.then((buffer) => {
					const base64 = buffer.toString('base64');
					const msg = `data: ${JSON.stringify({ type: 'done', base64, filename: `Табель_${year}_${String(month).padStart(2, '0')}.xlsx` })}\n\n`;
					controller.enqueue(new TextEncoder().encode(msg));
					controller.close();
				})
				.catch((err) => {
					console.error('buildT12 error:', err.message);
					console.error(err.stack);
					const msg = `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`;
					controller.enqueue(new TextEncoder().encode(msg));
					controller.close();
				});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
