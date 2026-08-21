import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { scheduleCardData, scheduleUpdate } from '$lib/server/apps/tabel/schedules';

export const load: PageServerLoad = async (event) => scheduleCardData(Number(event.params.id));

export const actions: Actions = {
	update: (event) =>
		runAction(async () => {
			const id = Number(event.params.id);
			const f = await event.request.formData();
			await scheduleUpdate(event.locals.user, id, {
				name: f.get('name')?.toString() || '',
				hoursStr: f.get('hours')?.toString() || '08:00',
				weekDays: f.getAll('weekDays').map(Number).filter(Boolean)
			});
			redirect(302, `/native/apps/tabel/schedules/${id}`);
		})
};
