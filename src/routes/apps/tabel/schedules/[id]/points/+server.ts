import { json } from '@sveltejs/kit';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { requireEdit } from '$lib/server/permissions';

export const GET = async (event) => {
	const scheduleId = Number(event.params.id);
	const points = await scheduleService.getPoints(scheduleId);
	return json({ points });
};

export const POST = async (event) => {
	requireEdit(event.locals.user);
	const scheduleId = Number(event.params.id);
	const f = await event.request.formData();
	const type = f.get('type')?.toString() as 'Entry' | 'Exit' | 'Break' | undefined;
	const time = f.get('time')?.toString();
	const endTime = f.get('endTime')?.toString() || null;
	const leftBound = Number(f.get('leftBound')) || 0;
	const rightBound = Number(f.get('rightBound')) || 0;

	if (!type || !time) return json({ error: 'missing fields' }, { status: 400 });

	const point = await scheduleService.createPoint({
		scheduleId,
		type,
		time,
		endTime,
		leftBound,
		rightBound
	});
	return json({ success: true, point });
};
