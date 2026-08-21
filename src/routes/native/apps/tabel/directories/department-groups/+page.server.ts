import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { runAction } from '$lib/server/context/controller';
import {
	departmentGroupsData,
	groupCreate,
	groupUpdate,
	groupRemove,
	groupSaveDepts
} from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async () => departmentGroupsData();

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			await groupCreate(event.locals.user, await event.request.formData());
			redirect(302, '/native/apps/tabel/directories/department-groups');
		}),
	update: (event) =>
		runAction(async () => {
			await groupUpdate(event.locals.user, await event.request.formData());
			redirect(302, '/native/apps/tabel/directories/department-groups');
		}),
	remove: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await groupRemove(event.locals.user, id);
			redirect(302, '/native/apps/tabel/directories/department-groups');
		}),
	saveDepts: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			const groupId = Number(f.get('groupId'));
			const deptIds = f.getAll('departmentIds').map(Number);
			const ok = await groupSaveDepts(event.locals.user, groupId, deptIds);
			if (!ok) return { success: false };
			redirect(302, '/native/apps/tabel/directories/department-groups');
		})
};
