import type { PageServerLoad } from './$types';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const year = Number(event.url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(event.url.searchParams.get('month')) || new Date().getMonth() + 1;

	const periodStart = new Date(year, month - 1, 1);
	const periodEnd = new Date(year, month, 0, 23, 59, 59);
	const events = await turnstileEventTrackerService.getByPeriod(id, periodStart, periodEnd);
	const eventTypes = await db.select().from(turnstileEvent);

	return { events, eventTypes, year, month };
};
