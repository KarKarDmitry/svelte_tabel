import { json } from '@sveltejs/kit';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';

export const GET = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	let schedules = await scheduleService.list();
	if (search) {
		const q = search.toLowerCase();
		schedules = schedules.filter((s) => s.name.toLowerCase().includes(q));
	}
	return json({ schedules });
};
