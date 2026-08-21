import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import { scheduleCardData, scheduleUpdate } from '$lib/server/apps/tabel/schedules';

export const load: PageServerLoad = async (event) => scheduleCardData(Number(event.params.id));

export const actions: Actions = {
	update: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			const f = await event.request.formData();
			const weekDaysRaw = f.get('weekDays')?.toString();
			await scheduleUpdate(event.locals.user, id, {
				name: f.get('name')?.toString(),
				hoursStr: f.get('hours')?.toString() || '08:00',
				weekDays: weekDaysRaw ? weekDaysRaw.split(',').map(Number).filter(Boolean) : []
			});
			return { success: true };
		})
};
