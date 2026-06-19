import type { LayoutServerLoad } from './$types';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async (event) => {
	const id = Number(event.params.id);
	const cal = await calendarService.getCalendarById(id);
	if (!cal) error(404, 'Календарь не найден');
	const days = await calendarService.getDays(id);
	const allSchedules = await scheduleService.list();
	return { calendar: cal, days, allSchedules };
};
