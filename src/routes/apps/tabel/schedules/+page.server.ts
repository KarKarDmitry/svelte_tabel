import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import { schedulesListData, scheduleCreate } from '$lib/server/apps/tabel/schedules';

export const load: PageServerLoad = async () => schedulesListData();

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			const weekDaysRaw = f.get('weekDays')?.toString();
			const s = await scheduleCreate(event.locals.user, {
				name: f.get('name')?.toString() || '',
				hoursStr: f.get('hours')?.toString() || '08:00',
				weekDays: weekDaysRaw ? weekDaysRaw.split(',').map(Number).filter(Boolean) : []
			});
			redirect(303, `/apps/tabel/schedules/${s.id}`);
		})
};
