import { json } from '@sveltejs/kit';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';

export const GET = async (event) => {
	const search = event.url.searchParams.get('search') || '';
	let deps = await departmentService.list();
	if (search) {
		const q = search.toLowerCase();
		deps = deps.filter((d) => d.name.toLowerCase().includes(q));
	}
	return json({ departments: deps, search });
};
