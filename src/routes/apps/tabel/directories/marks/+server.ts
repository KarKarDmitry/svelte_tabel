import { json } from '@sveltejs/kit';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';

export const GET = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	let items = await dayMarkService.list();
	if (search) {
		const q = search.toLowerCase();
		items = items.filter(
			(m) =>
				m.name.toLowerCase().includes(q) ||
				m.shortName.toLowerCase().includes(q) ||
				m.code.toLowerCase().includes(q)
		);
	}
	return json({ dayMarks: items, search });
};
