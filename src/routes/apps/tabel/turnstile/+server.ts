import { json } from '@sveltejs/kit';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';

const PAGE_SIZE = 50;

export const GET = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	const page = Math.max(1, Number(event.url.searchParams.get('page')) || 1);

	const result = await turnstileEventTrackerService.searchWithFilters({
		search,
		page,
		pageSize: PAGE_SIZE
	});

	return json(result);
};
