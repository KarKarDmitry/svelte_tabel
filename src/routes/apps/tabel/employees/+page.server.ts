import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import { employeesListData, employeeDelete } from '$lib/server/apps/tabel/employees';

export const load: PageServerLoad = async (event) =>
	employeesListData(event.locals.user, event.url);

export const actions: Actions = {
	/** Полное удаление сотрудника (каскадом) — только для администраторов */
	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await employeeDelete(event.locals.user, id);
			return { success: true };
		})
};
