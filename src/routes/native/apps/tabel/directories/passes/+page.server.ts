import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { denyIfNotAdmin, isAdmin } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) {
		throw redirect(303, '/native/apps/tabel/directories/departments');
	}
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
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const seria = f.get('seria')?.toString() || null;
		const number = f.get('number')?.toString();
		if (!number) return fail(400, { message: 'Номер обязателен' });
		await passService.create({ seria, number });
		redirect(302, '/native/apps/tabel/directories/passes');
	},

	update: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const id = Number(f.get('id'));
		const seria = f.get('seria')?.toString() || null;
		const number = f.get('number')?.toString();
		if (!number) return fail(400, { message: 'Номер обязателен' });
		await passService.update(id, { seria, number });
		redirect(302, '/native/apps/tabel/directories/passes');
	},

	delete: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const id = Number((await event.request.formData()).get('id'));
		await passService.remove(id);
		redirect(302, '/native/apps/tabel/directories/passes');
	}
};
