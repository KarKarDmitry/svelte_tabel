import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';

export const load: LayoutServerLoad = async (event) => {
	const id = Number(event.params.id);
	const tpl = await calendarService.getTemplateById(id);
	if (!tpl) error(404, 'Шаблон не найден');
	const rules = await calendarService.getRules(id);
	const allSchedules = await scheduleService.list();
	return { template: tpl, rules, allSchedules };
};
