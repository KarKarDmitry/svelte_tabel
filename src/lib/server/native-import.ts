/** Фоновый импорт для нативного режима: переиспользует существующий SSE-эндпоинт
 *  /apps/tabel/import, читает стрим по кускам и пишет статус в import-process. */

import { getProcess, setStatus } from './import-process';

const XLS_TYPE = 'application/vnd.ms-excel';

async function readSseStream(id: string, res: Response): Promise<void> {
	const reader = res.body?.getReader();
	if (!reader) {
		setStatus(id, { stage: 'error', message: 'Пустой ответ сервера' });
		return;
	}
	const decoder = new TextDecoder();
	let buffer = '';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let idx: number;
			while ((idx = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, idx).trim();
				buffer = buffer.slice(idx + 1);
				if (!line.startsWith('data: ')) continue;
				let msg: any;
				try {
					msg = JSON.parse(line.slice(6));
				} catch {
					continue;
				}
				if (msg.stage === 'unresolved') {
					setStatus(id, {
						stage: 'unresolved',
						current: msg.current ?? 0,
						total: msg.total ?? 0,
						message: msg.message ?? '',
						unresolved: msg.unresolved ?? []
					});
				} else if (msg.stage === 'error') {
					setStatus(id, { stage: 'error', error: true, message: msg.message ?? 'Ошибка импорта' });
				} else if (msg.stage === 'done') {
					setStatus(id, {
						stage: 'done',
						done: true,
						current: msg.current ?? 0,
						total: msg.total ?? 0,
						message: msg.message ?? 'Импорт завершён'
					});
				} else if (msg.stage) {
					setStatus(id, {
						stage: msg.stage,
						current: msg.current ?? 0,
						total: msg.total ?? 0,
						message: msg.message ?? '',
						employee: msg.employee ?? undefined
					});
				}
			}
		}
	} catch (e: any) {
		setStatus(id, { stage: 'error', error: true, message: `Ошибка чтения: ${e?.message ?? e}` });
	}
}

export async function runImportProcess(id: string): Promise<void> {
	const proc = getProcess(id);
	if (!proc) return;

	setStatus(id, { stage: 'parsing', current: 0, total: 0, message: 'Отправка файла...' });

	const fd = new FormData();
	fd.append('file', new Blob([proc.file], { type: XLS_TYPE }), proc.fileName);
	if (proc.skipPasses?.length) {
		fd.append('skipPasses', JSON.stringify(proc.skipPasses));
	}

	let res: Response;
	try {
		res = await fetch(proc.origin + '/apps/tabel/import', {
			method: 'POST',
			body: fd,
			headers: { cookie: proc.cookie }
		});
	} catch (e: any) {
		setStatus(id, { stage: 'error', error: true, message: `Ошибка импорта: ${e?.message ?? e}` });
		return;
	}

	if (!res.ok) {
		setStatus(id, { stage: 'error', error: true, message: `HTTP ${res.status}` });
		return;
	}

	await readSseStream(id, res);
}

/** Фаза 2: создать пропуска по выбору пользователя (PUT), затем продолжить импорт */
export async function runResolveProcess(id: string): Promise<void> {
	const proc = getProcess(id);
	if (!proc) return;

	setStatus(id, { stage: 'resolving', current: 0, total: 0, message: 'Создание пропусков...' });

	try {
		const putRes = await fetch(proc.origin + '/apps/tabel/import', {
			method: 'PUT',
			headers: { cookie: proc.cookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ unresolved: proc.picks ?? [] })
		});
		const data = await putRes.json();
		proc.skipPasses = data?.skipList ?? [];
	} catch {
		setStatus(id, { stage: 'error', error: true, message: 'Ошибка создания пропусков' });
		return;
	}

	await runImportProcess(id);
}
