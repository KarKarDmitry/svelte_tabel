import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import { employeePassData, passAssign, passRemove } from '$lib/server/apps/tabel/employees';

export const load: PageServerLoad = async (event) => employeePassData(Number(event.params.id));

export const actions: Actions = {
	assignPass: (event) =>
		runAction(async () => {
			const employeeId = Number(event.params.id);
			const res = await passAssign(event.locals.user, employeeId, await event.request.formData());
			if (res === 'occupied') {
				return { success: false, error: 'Пропуск уже назначен другому сотруднику' };
			}
			return { success: true };
		}),
	removePass: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await passRemove(event.locals.user, id);
			return { success: true };
		})
};
