import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';

export const load: PageServerLoad = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	let items = await positionService.list();
	if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
	return { positions: items, search };
};

export const actions: Actions = {
	create: async (event) => {
		const name = (await event.request.formData()).get('name')?.toString();
		if (!name) return fail(400);
		await positionService.create({ name });
		return { success: true };
	},
	update: async (event) => {
		const f = await event.request.formData();
		await positionService.update(Number(f.get('id')), { name: f.get('name')?.toString() || '' });
		return { success: true };
	},
	delete: async (event) => {
		await positionService.remove(Number((await event.request.formData()).get('id')));
		return { success: true };
	}
};
