import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { getProcess } from '$lib/server/import-process';
import { isAdmin } from '$lib/server/permissions';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) {
		throw redirect(303, '/native/apps/tabel/tabel');
	}
	const proc = getProcess(event.params.id);
	if (!proc) {
		throw error(404, 'Процесс не найден');
	}
	return { id: event.params.id, fileName: proc.fileName, status: proc.status };
};
