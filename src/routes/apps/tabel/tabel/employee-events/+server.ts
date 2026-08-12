import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { worktimeTracker } from '$lib/server/db/apps/tabel/tables/worktime-tracker';
import { getEmployeeEventsData } from '$lib/server/db/apps/tabel/services/employee-events.service';
import { db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { canEdit, getControlledDepartmentIds } from '$lib/server/permissions';

/** GET: загрузить данные для модального окна (логика вынесена в сервис) */
export const GET: RequestHandler = async ({ url }) => {
	const employeeId = Number(url.searchParams.get('employeeId'));
	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month'));
	return json(await getEmployeeEventsData(employeeId, year, month));
};

/** POST: сохранить изменения из модального окна */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { employeeId, year, month, days } = (await request.json()) as {
		employeeId: number;
		year: number;
		month: number;
		days: Array<{
			date: string;
			reportWorkTime: number | null;
			reportNightWorkTime: number | null;
			dayMarkCode: string;
			extraMarkCode?: string | null;
			extraMarkMinutes?: number | null;
		}>;
	};

	if (!employeeId || !days?.length) {
		error(400, 'employeeId and days are required');
	}

	// Запись разрешена только admin/timekeeper и только в подконтрольных подразделениях
	if (!canEdit(locals.user)) {
		error(403, 'Недостаточно прав для редактирования');
	}
	if (locals.user?.role !== 'admin') {
		const controlled = await getControlledDepartmentIds(locals.user);
		for (const day of days) {
			const mark = day.dayMarkCode.trim();
			if (
				!mark &&
				day.reportWorkTime == null &&
				day.reportNightWorkTime == null &&
				!day.extraMarkCode?.trim()
			)
				continue;
			const dept = await employeeService.getDepartmentAtDate(employeeId, day.date);
			if (!dept || !controlled?.includes(dept.id)) {
				error(403, 'Подразделение не подконтрольно');
			}
		}
	}

	const updatedBy = locals.user?.name ?? locals.user?.email ?? null;
	const updated: Array<{
		employeeId: number;
		date: string;
		reportWorkTime: number | null;
		reportNightWorkTime: number | null;
		dayMarkCode: string | null;
		extraMarkCode?: string | null;
		extraMarkMinutes?: number | null;
	}> = [];

	for (const day of days) {
		const mark = day.dayMarkCode.trim();
		if (
			!mark &&
			day.reportWorkTime == null &&
			day.reportNightWorkTime == null &&
			!day.extraMarkCode?.trim()
		)
			continue;

		const result = await worktimeService.updateDayMark(
			employeeId,
			day.date,
			mark,
			updatedBy,
			day.extraMarkCode?.trim() || null,
			day.extraMarkMinutes ?? null
		);

		const explicitHours = day.reportWorkTime !== undefined && day.reportWorkTime !== null;
		const explicitNight = day.reportNightWorkTime !== undefined && day.reportNightWorkTime !== null;

		if (
			explicitHours ||
			explicitNight ||
			day.extraMarkCode?.trim() ||
			day.extraMarkMinutes != null
		) {
			const setData: any = {};
			if (explicitHours) setData.reportWorkTime = day.reportWorkTime;
			if (explicitNight) setData.reportNightWorkTime = day.reportNightWorkTime;
			if (day.extraMarkCode?.trim()) setData.extraMarkCode = day.extraMarkCode.trim();
			if (day.extraMarkMinutes != null) setData.extraMarkMinutes = day.extraMarkMinutes;

			if (Object.keys(setData).length > 0) {
				await db
					.update(worktimeTracker)
					.set(setData)
					.where(
						and(eq(worktimeTracker.employeeId, employeeId), eq(worktimeTracker.date, day.date))
					);
			}
		}

		updated.push({
			employeeId,
			date: day.date,
			reportWorkTime: day.reportWorkTime ?? result.reportWorkTime,
			reportNightWorkTime: day.reportNightWorkTime ?? result.reportNightWorkTime,
			dayMarkCode: mark || result.dayMarkCode,
			extraMarkCode: day.extraMarkCode?.trim() || result.extraMarkCode || null,
			extraMarkMinutes: day.extraMarkMinutes ?? result.extraMarkMinutes ?? null
		});
	}

	return json({ updated });
};
