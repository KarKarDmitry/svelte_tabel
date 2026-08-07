import { json } from '@sveltejs/kit';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { requireEdit } from '$lib/server/permissions';

export const PATCH = async (event) => {
	requireEdit(event.locals.user);
	const id = Number(event.params.pointId);
	const f = await event.request.formData();
	const type = f.get('type')?.toString() as 'Entry' | 'Exit' | 'Break' | undefined;
	const time = f.get('time')?.toString();
	const endTime = f.get('endTime')?.toString() || null;
	const leftBound = Number(f.get('leftBound'));
	const rightBound = Number(f.get('rightBound'));

	await scheduleService.updatePoint(id, { type, time, endTime, leftBound, rightBound });
	return json({ success: true });
};

export const DELETE = async (event) => {
	requireEdit(event.locals.user);
	const id = Number(event.params.pointId);
	await scheduleService.removePoint(id);
	return json({ success: true });
};
