import { json } from '@sveltejs/kit';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';

export const GET = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	let items = await positionService.list();
	if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
	return json({ positions: items, search });
};
