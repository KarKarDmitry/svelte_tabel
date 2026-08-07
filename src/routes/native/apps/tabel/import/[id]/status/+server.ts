import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcess } from '$lib/server/import-process';

export const GET: RequestHandler = async ({ params }) => {
	const proc = getProcess(params.id);
	if (!proc) return json({ error: 'not found' }, { status: 404 });
	return json(proc.status);
};
