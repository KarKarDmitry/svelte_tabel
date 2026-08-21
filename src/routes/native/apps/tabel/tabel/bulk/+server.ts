import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bulkAssignMarks } from '$lib/server/apps/tabel/tabel-core';
import { ControllerError } from '$lib/server/context/controller';

/**
 * Массовое назначение отметок подразделению (XP-версия, обычный JSON без devalue).
 * Вход: form-urlencoded deptId + updates (JSON-массив [{ employeeId, date, shortName, hours }]).
 * В ответе — updated[] со стилями ячеек для динамического обновления без reload.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const fd = await request.formData();
	try {
		const { count, updated } = await bulkAssignMarks(locals.user, {
			deptId: Number(fd.get('deptId')),
			updatesRaw: String(fd.get('updates') ?? '')
		});
		return json({ ok: true, count, updated });
	} catch (err) {
		if (err instanceof ControllerError) {
			return json({ ok: false, error: err.message }, { status: err.status });
		}
		console.error('[native bulkAssign] ошибка:', err);
		if (err instanceof Error && err.stack) console.error(err.stack);
		return json(
			{
				ok: false,
				error:
					'Не удалось применить назначение: ' + (err instanceof Error ? err.message : String(err))
			},
			{ status: 500 }
		);
	}
};
