import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import {
	getEmployeeEventsData,
	saveEmployeeEvents
} from '$lib/server/db/apps/tabel/services/employee-events.service';
import { isAdmin, canEdit, getControlledDepartmentIds } from '$lib/server/permissions';

/** GET: данные для диалога «События сотрудника» (native) — light-расцветка, обычный JSON */
export const GET: RequestHandler = async ({ url, locals }) => {
	const employeeId = Number(url.searchParams.get('employeeId'));
	const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1;

	if (!employeeId) throw error(400, 'Неверный ID');

	// Не-админ: сотрудник должен быть в подконтрольном отделе (на сегодня)
	if (!isAdmin(locals.user)) {
		const controlled = await getControlledDepartmentIds(locals.user);
		const dep = await employeeService.getDepartmentAtDate(
			employeeId,
			new Date().toISOString().split('T')[0]
		);
		if (!dep || !controlled?.includes(dep.id)) {
			throw error(403, 'Доступ запрещён');
		}
	}

	const data = await getEmployeeEventsData(employeeId, year, month);
	return json({
		...data,
		// native без тёмной темы — отдаём плоский светлый набор расцветки
		cellColorRules: (data.cellColorRules as any)?.light ?? data.cellColorRules ?? {},
		markColorRules: (data.markColorRules as any)?.light ?? data.markColorRules ?? {}
	});
};

/** POST: сохранить изменения из диалога (XP, обычный JSON без devalue) */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { employeeId, days } = (await request.json()) as {
		employeeId: number;
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
		throw error(400, 'employeeId and days are required');
	}

	if (!canEdit(locals.user)) {
		throw error(403, 'Недостаточно прав для редактирования');
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
				throw error(403, 'Подразделение не подконтрольно');
			}
		}
	}

	const updatedBy = locals.user?.name ?? locals.user?.email ?? null;
	const updated = await saveEmployeeEvents(employeeId, days, updatedBy);

	return json({ ok: true, updated });
};
