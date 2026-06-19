import type { PageServerLoad } from './$types';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';
import { db } from '$lib/server/db';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async (event) => {
	const url = event.url;
	const search = url.searchParams.get('search') || '';
	const eventId = url.searchParams.get('eventId') ? Number(url.searchParams.get('eventId')) : null;
	const dateFrom = url.searchParams.get('dateFrom') || '';
	const dateTo = url.searchParams.get('dateTo') || '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	const [result, eventTypes] = await Promise.all([
		turnstileEventTrackerService.searchWithFilters({
			search,
			eventId,
			dateFrom: dateFrom || null,
			dateTo: dateTo || null,
			page,
			pageSize: PAGE_SIZE
		}),
		db.select().from(turnstileEvent).orderBy(turnstileEvent.name)
	]);

	return { ...result, eventTypes, search, eventId, dateFrom, dateTo };
};
