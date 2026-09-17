import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import {
	departmentsData,
	departmentCreate,
	departmentUpdate,
	departmentDelete
} from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async (event) => departmentsData(event.url);

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			const form = await event.request.formData();
			const ppRaw = form.get('pp');
			const ppNum = ppRaw !== null && ppRaw !== '' ? Number(ppRaw) : undefined;

			// Дополнительная проверка на валидность числа
			const pp: number | undefined = ppNum !== undefined && !isNaN(ppNum) ? ppNum : undefined;

			await departmentCreate(event.locals.user, form.get('name')?.toString(), pp);
			return { success: true };
		}),
	update: (event) =>
		runAction(async () => {
			const form = await event.request.formData();
			const ppRaw = form.get('pp');
			const ppNum = ppRaw !== null && ppRaw !== '' ? Number(ppRaw) : undefined;

			// Дополнительная проверка на валидность числа
			const pp: number | undefined = ppNum !== undefined && !isNaN(ppNum) ? ppNum : undefined;

			await departmentUpdate(
				event.locals.user,
				Number(form.get('id')),
				form.get('name')?.toString(),
				pp
			);
			return { success: true };
		}),
	delete: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await departmentDelete(event.locals.user, id);
			return { success: true };
		})
};
