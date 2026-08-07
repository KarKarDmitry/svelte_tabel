import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
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
		redirect(302, '/native/apps/tabel/directories/departments');
	},

	update: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const form = await event.request.formData();
		const id = Number(form.get('id'));
		const name = form.get('name')?.toString();
		if (!name) return fail(400, { message: 'Название обязательно' });
		await departmentService.update(id, { name });
		redirect(302, '/native/apps/tabel/directories/departments');
	},

	delete: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await departmentService.remove(id);
		redirect(302, '/native/apps/tabel/directories/departments');
	}
};
