import type { PageServerLoad } from './$types';
import { employeesListData } from '$lib/server/apps/tabel/employees';

export const load: PageServerLoad = async (event) =>
	employeesListData(event.locals.user, event.url);
