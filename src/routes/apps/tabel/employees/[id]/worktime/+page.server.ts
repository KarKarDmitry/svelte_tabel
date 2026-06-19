import type { PageServerLoad } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const year = Number(event.url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(event.url.searchParams.get('month')) || new Date().getMonth() + 1;

	const worktimeRecords = await worktimeService.getMonth(id, year, month);
	const dayMarks = await dayMarkService.list();

	return { worktimeRecords, dayMarks, year, month };
};
