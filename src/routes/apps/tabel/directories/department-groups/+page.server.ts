import type { PageServerLoad, Actions } from './$types';
import { runAction } from '$lib/server/context/controller';
import {
	departmentGroupsData,
	groupCreate,
	groupUpdate,
	groupRemove,
	groupAddDept,
	groupRemoveDept,
	groupSaveDepts
} from '$lib/server/apps/tabel/directories';

export const load: PageServerLoad = async () => departmentGroupsData();

export const actions: Actions = {
	create: (event) =>
		runAction(async () => {
			await groupCreate(event.locals.user, await event.request.formData());
			return { success: true };
		}),
	update: (event) =>
		runAction(async () => {
			await groupUpdate(event.locals.user, await event.request.formData());
			return { success: true };
		}),
	remove: (event) =>
		runAction(async () => {
			const id = Number((await event.request.formData()).get('id'));
			await groupRemove(event.locals.user, id);
			return { success: true };
		}),
	addDept: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			await groupAddDept(
				event.locals.user,
				Number(f.get('groupId')),
				Number(f.get('departmentId'))
			);
			return { success: true };
		}),
	removeDept: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			await groupRemoveDept(
				event.locals.user,
				Number(f.get('groupId')),
				Number(f.get('departmentId'))
			);
			return { success: true };
		}),
	saveDepts: (event) =>
		runAction(async () => {
			const f = await event.request.formData();
			const groupId = Number(f.get('groupId'));
			const deptIds = f.getAll('departmentIds').map(Number);
			const ok = await groupSaveDepts(event.locals.user, groupId, deptIds);
			if (!ok) return { success: false };
			return { success: true };
		})
};
