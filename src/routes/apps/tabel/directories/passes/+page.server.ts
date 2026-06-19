import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';

export const load: PageServerLoad = async (event) => {
	const seriaSearch = event.url.searchParams.get('seria') || '';
	const numberSearch = event.url.searchParams.get('number') || '';
	let passes = await passService.listWithOwners();
	if (seriaSearch) {
		const q = seriaSearch.toLowerCase();
		passes = passes.filter((r: any) => r.pass.seria?.toLowerCase().includes(q));
	}
	if (numberSearch) {
		const q = numberSearch.toLowerCase();
		passes = passes.filter((r: any) => r.pass.number.toLowerCase().includes(q));
	}
	return { passes, seriaSearch, numberSearch };
};

export const actions: Actions = {
	create: async (event) => {
		const f = await event.request.formData();
		const seria = f.get('seria')?.toString() || null;
		const number = f.get('number')?.toString();
		if (!number) return fail(400, { message: 'Номер обязателен' });
		await passService.create({ seria, number });
		return { success: true };
	},
	update: async (event) => {
		const f = await event.request.formData();
		const id = Number(f.get('id'));
		const seria = f.get('seria')?.toString() || null;
		const number = f.get('number')?.toString();
		if (!number) return fail(400, { message: 'Номер обязателен' });
		await passService.update(id, { seria, number });
		return { success: true };
	},
	delete: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		await passService.remove(id);
		return { success: true };
	}
};
