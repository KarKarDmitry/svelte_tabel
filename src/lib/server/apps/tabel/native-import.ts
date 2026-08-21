/** Фоновый импорт для нативного режима: вызывает общий конвейер напрямую
 *  (без self-HTTP и сохранённой cookie) и пишет прогресс в import-process. */

import { getProcess, setStatus, scheduleDelete, type ImportStatus } from './import-process';
import {
	runTurnstileImport,
	resolvePassPicks,
	type ImportEvent
} from '$lib/server/db/apps/tabel/services/turnstile-import.service';

/** Прогресс-события конвейера → статус процесса (для опроса страницей /import/[id]) */
function emitToStatus(id: string, ev: ImportEvent) {
	const patch: Partial<ImportStatus> = {
		stage: ev.stage,
		current: ev.current ?? 0,
		total: ev.total ?? 0,
		message: ev.message ?? '',
		employee: ev.employee,
		unresolved: ev.unresolved
	};
	if (ev.stage === 'done') patch.done = true;
	if (ev.stage === 'error') patch.error = true;
	setStatus(id, patch);
}

export async function runImportProcess(id: string): Promise<void> {
	const proc = getProcess(id);
	if (!proc) return;

	setStatus(id, { stage: 'parsing', current: 0, total: 0, message: 'Обработка файла...' });

	try {
		await runTurnstileImport({
			file: proc.file,
			skipPasses: proc.skipPasses,
			emit: (ev) => emitToStatus(id, ev)
		});
	} catch (e: any) {
		setStatus(id, { stage: 'error', error: true, message: `Ошибка импорта: ${e?.message ?? e}` });
		scheduleDelete(id);
		return;
	}

	// Терминальные стадии (done/error) сервис шлёт через emit; процесс удаляем после того,
	// как клиент успеет дочитать финальный статус. При unresolved процесс остаётся
	// (пользователь выбирает сотрудников), по TTL его вычистит sweep.
	const last = getProcess(id);
	if (last && (last.status.stage === 'done' || last.status.error)) {
		scheduleDelete(id);
	} else if (last && last.status.stage !== 'unresolved') {
		setStatus(id, { stage: 'error', error: true, message: 'Импорт завершился некорректно' });
		scheduleDelete(id);
	}
}

/** Фаза 2: создать пропуска по выбору пользователя (прямой вызов), затем продолжить импорт */
export async function runResolveProcess(id: string): Promise<void> {
	const proc = getProcess(id);
	if (!proc) return;

	setStatus(id, { stage: 'resolving', current: 0, total: 0, message: 'Создание пропусков...' });

	try {
		const result = await resolvePassPicks(proc.picks ?? []);
		proc.skipPasses = result.skipList;
	} catch (e: any) {
		setStatus(id, {
			stage: 'error',
			error: true,
			message: `Ошибка создания пропусков: ${e?.message ?? e}`
		});
		scheduleDelete(id);
		return;
	}

	await runImportProcess(id);
}
