import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { denyIfNotAdmin, isAdmin } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) {
		throw redirect(303, '/native/apps/tabel/directories/departments');
	}
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
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		await dayMarkService.create({
			name: f.get('name')?.toString() || '',
			shortName: f.get('shortName')?.toString() || '',
			code: f.get('code')?.toString() || '',
			category: (f.get('category')?.toString() as any) || 'work',
			reportExclude: f.get('reportExclude') === 'true'
		});
		redirect(302, '/native/apps/tabel/directories/marks');
	},

	update: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		const f = await event.request.formData();
		await dayMarkService.update(Number(f.get('id')), {
			name: f.get('name')?.toString(),
			shortName: f.get('shortName')?.toString(),
			code: f.get('code')?.toString(),
			category: (f.get('category')?.toString() as any) || undefined,
			reportCode: f.get('reportCode')?.toString() || undefined,
			reportExclude: f.get('reportExclude') === 'true'
		});
		redirect(302, '/native/apps/tabel/directories/marks');
	},

	delete: async (event) => {
		const denied = denyIfNotAdmin(event.locals.user);
		if (denied) return denied;
		await dayMarkService.remove(Number((await event.request.formData()).get('id')));
		redirect(302, '/native/apps/tabel/directories/marks');
	}
};
