import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setDayMark } from '$lib/server/apps/tabel/tabel-core';
import { ControllerError } from '$lib/server/context/controller';

/** Точечное обновление отметки (нативный JS-клиент): обычный JSON, без devalue */
export const POST: RequestHandler = async ({ request, locals }) => {
	const fd = await request.formData();
	try {
		const { updated, style } = await setDayMark(locals.user, {
			employeeId: Number(fd.get('employeeId')),
			date: String(fd.get('date') ?? ''),
			shortName: String(fd.get('shortName') ?? '')
		});
		return json({ ok: true, updated: { ...updated, style } });
	} catch (e) {
		if (e instanceof ControllerError) throw error(e.status, e.message);
		throw e;
	}
};
