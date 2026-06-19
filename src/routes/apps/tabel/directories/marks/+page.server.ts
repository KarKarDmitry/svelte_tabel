import type { PageServerLoad } from './$types';
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';

export const load: PageServerLoad = async (event) => {
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
	return { dayMarks: items, search };
};

export const actions: Actions = {
	create: async (event) => {
		const f = await event.request.formData();
		await dayMarkService.create({
			name: f.get('name')?.toString() || '',
			shortName: f.get('shortName')?.toString() || '',
			code: f.get('code')?.toString() || '',
			category: f.get('category')?.toString() as any,
			reportExclude: f.get('reportExclude') === 'true'
		});
		return { success: true };
	},
	update: async (event) => {
		const f = await event.request.formData();
		await dayMarkService.update(Number(f.get('id')), {
			name: f.get('name')?.toString(),
			shortName: f.get('shortName')?.toString(),
			code: f.get('code')?.toString(),
			category: f.get('category')?.toString() as any,
			reportCode: f.get('reportCode')?.toString(),
			reportExclude: f.get('reportExclude') === 'true'
		});
		return { success: true };
	},
	delete: async (event) => {
		await dayMarkService.remove(Number((await event.request.formData()).get('id')));
		return { success: true };
	}
};
