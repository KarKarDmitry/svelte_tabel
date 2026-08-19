import { json } from '@sveltejs/kit';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { requireAdmin } from '$lib/server/permissions';

export const GET = async (event) => {
	requireAdmin(event.locals.user);
	const search = event.url.searchParams.get('search') || '';
	let items = await appConstantService.list();
	if (search) {
		const q = search.toLowerCase();
		items = items.filter(
			(c) => c.key.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
		);
	}
	return json({ constants: items, search });
};
