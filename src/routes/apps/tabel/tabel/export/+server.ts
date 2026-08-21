import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireEdit } from '$lib/server/permissions';
import { buildT12Workbook } from '$lib/server/apps/tabel/export';

export const POST: RequestHandler = async ({ request, locals }) => {
	requireEdit(locals.user);

	const { year, month } = await request.json();

	if (!year || !month) {
		return json({ error: 'year and month are required' }, { status: 400 });
	}

	const buffer = await buildT12Workbook(locals.user, { year, month });

	const filename = `Табель_${year}_${String(month).padStart(2, '0')}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
