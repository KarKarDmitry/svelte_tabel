import type { PageServerLoad } from './$types';
import { employeeEventsData } from '$lib/server/apps/tabel/employees';

export const load: PageServerLoad = async (event) => {
	const year = Number(event.url.searchParams.get('year'));
	const month = Number(event.url.searchParams.get('month'));
	return employeeEventsData(Number(event.params.id), year, month);
};
