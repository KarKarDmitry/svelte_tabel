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
		const weekDays = f.getAll('weekDays').map(Number).filter(Boolean);

		const s = await scheduleService.create({
			name,
			standardWorkTime,
			weekDays: weekDays.length ? JSON.stringify(weekDays) : null
		});

		redirect(303, `/native/apps/tabel/schedules/${s.id}`);
	}
};
