import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProcess, setPicks } from '$lib/server/import-process';
import { runResolveProcess } from '$lib/server/native-import';
import { isAdmin } from '$lib/server/permissions';

/** Продолжить импорт после выбора сотрудников (без файла — он в процессе) */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!isAdmin(locals.user)) throw error(403, 'Требуются права администратора');

	const proc = getProcess(params.id);
	if (!proc) throw error(404, 'Процесс не найден');

	const fd = await request.formData();
	const unresolved = proc.status.unresolved ?? [];
	const picks: {
		seria: string;
		number: string;
		passId?: number | null;
		employeeId: number;
		dateFrom?: string;
	}[] = [];

	for (const [k, v] of fd.entries()) {
		if (!k.startsWith('pick_')) continue;
		const i = Number(k.slice(5));
		const u = (unresolved as any[])[i];
		if (!u) continue;
		const empId = Number(v) || 0;
		picks.push({
			seria: u.seria,
			number: u.number,
			passId: u.passId ?? null,
			employeeId: empId,
			dateFrom: u.firstDate ?? undefined
		});
	}

	setPicks(proc.id, picks);
	void runResolveProcess(proc.id);

	return json({ ok: true });
};
