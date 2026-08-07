import type { PageServerLoad, Actions } from './$types';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { error } from '@sveltejs/kit';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const s = await scheduleService.getWithPoints(id);
	if (!s) error(404, 'График не найден');
	return { schedule: s };
};

export const actions: Actions = {
	update: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number(event.params.id);
		const f = await event.request.formData();
		const name = f.get('name')?.toString();
		const hoursStr = f.get('hours')?.toString() || '08:00';
		const [h, m] = hoursStr.split(':').map(Number);
		const standardWorkTime = h * 60 + (m || 0);
		const weekDaysRaw = f.get('weekDays')?.toString();
		const weekDays = weekDaysRaw
			? JSON.stringify(weekDaysRaw.split(',').map(Number).filter(Boolean))
			: null;

		await scheduleService.update(id, {
			name,
			standardWorkTime,
			weekDays
		});
		return { success: true };
	}
};
