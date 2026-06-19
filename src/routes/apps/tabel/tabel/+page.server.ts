import type { PageServerLoad, Actions } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';

const PAGE_SIZE = 200;

export const load: PageServerLoad = async (event) => {
	const url = event.url;
	const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
	const month = Number(url.searchParams.get('month')) || new Date().getMonth() + 1;
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

	return await worktimeService.getMonthGrouped(year, month, { page, pageSize: PAGE_SIZE });
};

export const actions: Actions = {
	updateDayMark: async (event) => {
		const f = await event.request.formData();
		const employeeId = Number(f.get('employeeId'));
		const date = f.get('date')?.toString() || '';
		const shortName = f.get('shortName')?.toString() || '';
		const updatedBy = event.locals.user?.name ?? event.locals.user?.email ?? null;

		const updated = await worktimeService.updateDayMark(employeeId, date, shortName, updatedBy);

		return { success: true, updated };
	},

	updateExtraMark: async (event) => {
		const f = await event.request.formData();
		const employeeId = Number(f.get('employeeId'));
		const date = f.get('date')?.toString() || '';
		const extraMarkCode = f.get('extraMarkCode')?.toString() || null;
		const extraMarkMinutesRaw = f.get('extraMarkMinutes')?.toString() || null;
		const extraMarkMinutes = extraMarkMinutesRaw ? Number(extraMarkMinutesRaw) : null;
		const updatedBy = event.locals.user?.name ?? event.locals.user?.email ?? null;

		await worktimeService.updateDayMark(
			employeeId,
			date,
			'',
			updatedBy,
			extraMarkCode,
			!isNaN(extraMarkMinutes ?? NaN) ? extraMarkMinutes : null
		);

		return { success: true };
	}
};
