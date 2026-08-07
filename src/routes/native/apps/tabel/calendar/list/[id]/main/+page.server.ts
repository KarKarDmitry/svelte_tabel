import type { PageServerLoad, Actions } from './$types';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { error, redirect } from '@sveltejs/kit';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.id);
	const cal = await calendarService.getCalendarById(id);
	if (!cal) throw error(404, 'Календарь не найден');
	const [days, allSchedules] = await Promise.all([
		calendarService.getDays(id),
		scheduleService.list()
	]);
	return { calendar: cal, days, allSchedules };
};

export const actions: Actions = {
	updateDay: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const calendarId = Number(event.params.id);
		const f = await event.request.formData();
		const date = f.get('date')?.toString() || '';
		if (!date) throw error(400, 'Дата обязательна');
		const dayType = (f.get('dayType')?.toString() || 'workday') as any;
		const hours = Number(f.get('workTime'));
		const workTime = !isNaN(hours) && hours > 0 ? Math.round(hours * 60) : null;
		const scheduleId = f.get('scheduleId') ? Number(f.get('scheduleId')) : null;

		await calendarService.upsertDay({
			calendarId,
			date,
			dayType,
			workTime,
			scheduleId,
			transferFrom: null
		});
		redirect(302, `/native/apps/tabel/calendar/list/${calendarId}/main`);
	}
};
