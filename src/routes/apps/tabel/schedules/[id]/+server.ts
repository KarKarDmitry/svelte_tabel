import { json } from '@sveltejs/kit';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';

export const GET = async (event) => {
	const id = Number(event.params.id);
	const s = await scheduleService.getWithPoints(id);
	if (!s) return json({ error: 'not found' }, { status: 404 });
	return json({ schedule: s });
};

export const PATCH = async (event) => {
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
	const s = await scheduleService.update(id, { name, standardWorkTime, weekDays });
	return json({ success: true, schedule: s });
};
