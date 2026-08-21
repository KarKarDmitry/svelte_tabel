import type { LayoutServerLoad } from './$types';
import { employeeLayoutData } from '$lib/server/apps/tabel/employees';

export const load: LayoutServerLoad = async (event) =>
	employeeLayoutData(event.locals.user, Number(event.params.id));
