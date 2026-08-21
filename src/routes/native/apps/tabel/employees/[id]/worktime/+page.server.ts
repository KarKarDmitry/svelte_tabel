import type { PageServerLoad } from './$types';
import { employeeWorktimeNativeData } from '$lib/server/apps/tabel/turnstile';

export const load: PageServerLoad = async (event) => {
	const year = Number(event.url.searchParams.get('year'));
	const month = Number(event.url.searchParams.get('month'));
	return employeeWorktimeNativeData(Number(event.params.id), year, month);
};
