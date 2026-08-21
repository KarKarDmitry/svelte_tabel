import type { PageServerLoad } from './$types';
import { tabelMonthNativeData } from '$lib/server/apps/tabel/tabel-core';

export const load: PageServerLoad = async (event) =>
	tabelMonthNativeData(event.locals.user, event.url);
