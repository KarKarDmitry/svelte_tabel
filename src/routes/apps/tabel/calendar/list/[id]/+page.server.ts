import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	redirect(307, `/apps/tabel/calendar/list/${event.params.id}/main`);
};
