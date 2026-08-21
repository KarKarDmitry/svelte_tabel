import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcess } from '$lib/server/apps/tabel/import-process';
import { requireAdmin } from '$lib/server/permissions';

export const GET: RequestHandler = async ({ params, locals }) => {
	requireAdmin(locals.user);

	const proc = getProcess(params.id);
	if (!proc) return json({ error: 'not found' }, { status: 404 });
	return json(proc.status);
};
