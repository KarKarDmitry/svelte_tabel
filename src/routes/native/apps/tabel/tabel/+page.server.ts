import type { PageServerLoad } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { getControlledDepartmentIds } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const url = event.url;
	const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1;
	const actual = url.searchParams.get('actual') === '1';

	const [data, groups, calendars, roundingRulesRow] = await Promise.all([
		worktimeService.getMonthGrouped(year, month),
		departmentGroupService.listWithDepartments(),
		calendarService.listCalendars(),
		appConstantService.getByKey('ROUNDING_RULES')
	]);

	let roundingRules: Record<string, unknown> | null = null;
	if (roundingRulesRow?.value) {
		try {
			roundingRules = JSON.parse(roundingRulesRow.value);
		} catch {
			roundingRules = null;
		}
	}

	// Не-админ видит только подконтрольные подразделения
	const controlled = await getControlledDepartmentIds(event.locals.user);
	let departments = data.departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		departments = data.departments.filter((d: any) => set.has(d.id));
	}

	// Группируем по группам подразделений (для отображения)
	const grouped = groups
		.map((g) => {
			const deptIds = new Set(g.departments.map((m: any) => m.departmentId));
			return {
				id: g.id,
				name: g.name,
				departments: departments.filter((d: any) => deptIds.has(d.id))
			};
		})
		.filter((g) => g.departments.length > 0);
	const inGroup = new Set(grouped.flatMap((g) => g.departments.map((d: any) => d.id)));
	const ungrouped = departments.filter((d: any) => !inGroup.has(d.id));
	if (ungrouped.length > 0) {
		grouped.push({ id: 0, name: 'Без группы', departments: ungrouped });
	}

	return { ...data, departments: grouped, calendars, roundingRules, year, month, actual };
};
