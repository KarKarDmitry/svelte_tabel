import type { PageServerLoad } from './$types';
import { turnstileData } from '$lib/server/apps/tabel/turnstile';

export const load: PageServerLoad = async (event) =>
	turnstileData(event.locals.user, event.url, { defaultMonth: true });
