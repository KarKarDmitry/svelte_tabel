import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { department } from '$lib/server/db/apps/tabel/tables/department';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	let deps = await departmentService.list();
	if (search) {
		const q = search.toLowerCase();
		deps = deps.filter((d) => d.name.toLowerCase().includes(q));
	}
	return { departments: deps, search };
};

export const actions: Actions = {
	create: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const name = (await event.request.formData()).get('name')?.toString();
		if (!name) return fail(400, { message: 'Название обязательно' });
		await departmentService.create({ name });
		return { success: true };
	},
	update: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const name = form.get('name')?.toString();
		if (!name) return fail(400, { message: 'Название обязательно' });
		await departmentService.update(id, { name });
		return { success: true };
	},
	delete: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await departmentService.remove(id);
		return { success: true };
	}
};
