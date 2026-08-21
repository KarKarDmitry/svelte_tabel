import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import {
	tabelMonthData,
	updateDayMarkCell,
	updateExtraMarkCell,
	bulkAssignForm
} from '$lib/server/apps/tabel/tabel-core';

export const load: PageServerLoad = async (event) => tabelMonthData(event.locals.user, event.url);

export const actions: Actions = {
	updateDayMark: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			const { updated } = await updateDayMarkCell(
				event.locals.user,
				Number(f.get('employeeId')),
				f.get('date')?.toString() || '',
				f.get('shortName')?.toString() || ''
			);
			return { success: true, updated };
		}),

	updateExtraMark: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			await updateExtraMarkCell(
				event.locals.user,
				Number(f.get('employeeId')),
				f.get('date')?.toString() || '',
				f.get('extraMarkCode')?.toString() || null,
				f.get('extraMarkMinutes')?.toString() || null
			);
			return { success: true };
		}),

	/** Массовое назначение отметок подразделению (сотрудники × даты) */
	bulkAssign: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			const result = await bulkAssignForm(
				event.locals.user,
				Number(f.get('deptId')),
				f.get('updates')?.toString() || ''
			);
			return result;
		})
};
