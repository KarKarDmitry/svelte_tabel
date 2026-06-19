import { json } from '@sveltejs/kit';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';

export const GET = async (event) => {
	const templateId = Number(event.params.id);
	const rules = await calendarService.getRules(templateId);
	return json({ rules });
};

export const POST = async (event) => {
	const templateId = Number(event.params.id);
	const f = await event.request.formData();
	const rule = await calendarService.createRule({
		templateId,
		month: Number(f.get('month')),
		day: Number(f.get('day')),
		autoTransfer: f.get('autoTransfer') === 'on',
		preHoliday: f.get('preHoliday') === 'on',
		preScheduleId: f.get('preScheduleId') ? Number(f.get('preScheduleId')) : null
	});
	return json({ success: true, rule });
};

export const PATCH = async (event) => {
	const f = await event.request.formData();
	const rule = await calendarService.updateRule(Number(f.get('id')), {
		month: Number(f.get('month')),
		day: Number(f.get('day')),
		autoTransfer: f.get('autoTransfer') === 'on',
		preHoliday: f.get('preHoliday') === 'on',
		preScheduleId: f.get('preScheduleId') ? Number(f.get('preScheduleId')) : null
	});
	return json({ success: true, rule });
};

export const DELETE = async (event) => {
	const id = Number((await event.request.formData()).get('id'));
	await calendarService.removeRule(id);
	return json({ success: true });
};
