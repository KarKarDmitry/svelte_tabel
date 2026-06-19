import { json } from '@sveltejs/kit';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';

export const GET = async () => {
	const templates = await calendarService.listTemplates();
	return json({ templates });
};

export const POST = async (event) => {
	const f = await event.request.formData();
	const name = f.get('name')?.toString() || '';
	const defaultWorkDays = JSON.stringify([1, 2, 3, 4, 5]);
	const defaultWorkTime = 480;
	const tpl = await calendarService.createTemplate({
		name,
		year: 0,
		defaultWorkDays,
		defaultWorkTime
	});
	return json({ success: true, id: tpl.id });
};

export const DELETE = async (event) => {
	const id = Number((await event.request.formData()).get('id'));
	await calendarService.removeTemplate(id);
	return json({ success: true });
};
