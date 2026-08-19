import type { PageServerLoad } from './$types';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';
import { db } from '$lib/server/db';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';
import { getControlledDepartmentIds } from '$lib/server/permissions';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async (event) => {
	const url = event.url;

	// По умолчанию — текущий месяц
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const lastDay = String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0');

	const search = url.searchParams.get('search') || '';
	const eventId = url.searchParams.get('eventId') ? Number(url.searchParams.get('eventId')) : null;
	const dateFrom = url.searchParams.get('dateFrom') || `${y}-${m}-01`;
	const dateTo = url.searchParams.get('dateTo') || `${y}-${m}-${lastDay}`;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	// Не-админ видит события только сотрудников подконтрольных подразделений
	const departmentIds = await getControlledDepartmentIds(event.locals.user);

	const [result, eventTypes] = await Promise.all([
		turnstileEventTrackerService.searchWithFilters({
			search,
			eventId,
			dateFrom: dateFrom || null,
			dateTo: dateTo || null,
			page,
			pageSize: PAGE_SIZE,
			departmentIds
		}),
		db.select().from(turnstileEvent).orderBy(turnstileEvent.name)
	]);

	return {
		...result,
		eventTypes,
		search,
		eventId,
		dateFrom,
		dateTo
	};
};
