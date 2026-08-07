import { json } from '@sveltejs/kit';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { requireEdit } from '$lib/server/permissions';

export const GET = async () => {
	const calendars = await calendarService.listCalendars();
	return json({ calendars });
};

export const DELETE = async (event) => {
	requireEdit(event.locals.user);
	const id = Number((await event.request.formData()).get('id'));
	await calendarService.removeCalendar(id);
	return json({ success: true });
};
