import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async () => {
	const schedules = await scheduleService.list();
	return { schedules };
};

export const actions: Actions = {
	create: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const name = f.get('name')?.toString() || '';
		const hoursStr = f.get('hours')?.toString() || '08:00';
		const [h, m] = hoursStr.split(':').map(Number);
		const standardWorkTime = h * 60 + (m || 0);
		const weekDaysRaw = f.get('weekDays')?.toString();
		const weekDays = weekDaysRaw
			? JSON.stringify(weekDaysRaw.split(',').map(Number).filter(Boolean))
			: null;

		const s = await scheduleService.create({
			name,
			standardWorkTime,
			weekDays
		});

		redirect(303, `/apps/tabel/schedules/${s.id}`);
	}
};
