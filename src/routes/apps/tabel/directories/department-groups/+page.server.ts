import type { PageServerLoad, Actions } from './$types';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { department } from '$lib/server/db/apps/tabel/tables/department';
import { db } from '$lib/server/db';
import { asc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const groups = await departmentGroupService.listWithDepartments();
	const allDepts = await db.select().from(department).orderBy(asc(department.name));
	return { groups, allDepts };
};

export const actions: Actions = {
	create: async (event) => {
		const f = await event.request.formData();
		await departmentGroupService.create({ name: f.get('name')?.toString() || '', sortOrder: Number(f.get('sortOrder')) || 0 });
		return { success: true };
	},
	update: async (event) => {
		const f = await event.request.formData();
		await departmentGroupService.update(Number(f.get('id')), { name: f.get('name')?.toString() });
		return { success: true };
	},
	remove: async (event) => {
		const f = await event.request.formData();
		await departmentGroupService.remove(Number(f.get('id')));
		return { success: true };
	},
	addDept: async (event) => {
		const f = await event.request.formData();
		await departmentGroupService.addDepartment(Number(f.get('groupId')), Number(f.get('departmentId')));
		return { success: true };
	},
	removeDept: async (event) => {
		const f = await event.request.formData();
		await departmentGroupService.removeDepartment(Number(f.get('groupId')), Number(f.get('departmentId')));
		return { success: true };
	}
};
