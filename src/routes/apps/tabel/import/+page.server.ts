import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/permissions';

/** Импорт — только для администраторов */
export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) {
		throw redirect(303, '/apps/tabel');
	}
	return {};
};
