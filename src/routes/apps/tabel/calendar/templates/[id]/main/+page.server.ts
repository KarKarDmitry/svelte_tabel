import type { Actions } from './$types';
import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';

export const actions: Actions = {
	update: async (event) => {
		const id = Number(event.params.id);
		const f = await event.request.formData();
		const name = f.get('name')?.toString();
		const defaultWorkDays = JSON.stringify(
			(f.get('weekDays')?.toString() || '')
				.split(',')
				.map(Number)
				.filter(Boolean)
		);
		const defaultWorkTime = Number(f.get('defaultWorkTime')) || 480;

		await calendarService.updateTemplate(id, { name, defaultWorkDays, defaultWorkTime });
		return { success: true };
	},

	generate: async (event) => {
		const id = Number(event.params.id);
		await calendarService.generateYear(id);
		return { success: true };
	}
};
