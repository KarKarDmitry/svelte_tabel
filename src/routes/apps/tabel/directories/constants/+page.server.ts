import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { denyIfNotAdmin, isAdmin } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) {
		throw redirect(303, '/apps/tabel/directories');
	}
	const search = event.url.searchParams.get('search') || '';
	let items = await appConstantService.list();
	if (search) {
		const q = search.toLowerCase();
		items = items.filter(
			(c) => c.key.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
		);
	}
	return { constants: items, search };
};

export const actions: Actions = {
	upsert: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		const key = f.get('key')?.toString() || '';
		const value = f.get('value')?.toString() || '';
		if (!key) return fail(400);
		await appConstantService.upsert(key, value);
		return { success: true };
	},
	delete: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const key = (await event.request.formData()).get('key')?.toString();
		if (!key) return fail(400);
		await appConstantService.remove(key);
		return { success: true };
	}
};
