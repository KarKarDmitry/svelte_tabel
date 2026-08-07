import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';
import { denyIfNoEdit } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	let items = await positionService.list();
	if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
	return { positions: items, search };
};

export const actions: Actions = {
	create: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const name = (await event.request.formData()).get('name')?.toString();
		if (!name) return fail(400, { message: 'Название обязательно' });
		await positionService.create({ name });
		redirect(302, '/native/apps/tabel/directories/positions');
	},

	update: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const id = Number(f.get('id'));
		const name = f.get('name')?.toString();
		if (!name) return fail(400, { message: 'Название обязательно' });
		await positionService.update(id, { name });
		redirect(302, '/native/apps/tabel/directories/positions');
	},

	delete: async (event) => {
		const denied = denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		await positionService.remove(Number((await event.request.formData()).get('id')));
		redirect(302, '/native/apps/tabel/directories/positions');
	}
};
