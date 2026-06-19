import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const id = event.params.id;
	redirect(307, `/apps/tabel/employees/${id}/main`);
};
