import { json } from '@sveltejs/kit';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';
import { getControlledDepartmentIds } from '$lib/server/permissions';

const PAGE_SIZE = 50;

export const GET = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	const page = Math.max(1, Number(event.url.searchParams.get('page')) || 1);

	// Не-админ видит события только сотрудников подконтрольных подразделений
	const departmentIds = await getControlledDepartmentIds(event.locals.user);

	const result = await turnstileEventTrackerService.searchWithFilters({
		search,
		page,
		pageSize: PAGE_SIZE,
		departmentIds
	});

	return json(result);
};
