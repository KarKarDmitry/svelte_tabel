/** Хранилище фоновых процессов импорта (нативный режим): статус + файл */

import { randomUUID } from 'node:crypto';

export type ImportStatus = {
	stage: string;
	current: number;
	total: number;
	message: string;
	employee?: string;
	unresolved?: unknown[];
	done?: boolean;
	error?: boolean;
};

export type ImportProcess = {
	id: string;
	file: Buffer;
	fileName: string;
	skipPasses: { seria: string; number: string }[];
	picks?: {
		seria: string;
		number: string;
		passId?: number | null;
		employeeId: number;
		dateFrom?: string;
	}[];
	status: ImportStatus;
	createdAt: number;
};

const processes = new Map<string, ImportProcess>();

/** Время жизни процесса: удаляется через 30 минут после создания (защита от утечек памяти) */
const TTL_MS = 30 * 60 * 1000;

/** Удаляем «зависшие» процессы старше TTL */
function sweep() {
	const now = Date.now();
	for (const [id, p] of processes) {
		if (now - p.createdAt > TTL_MS) processes.delete(id);
	}
}

export function createProcess(file: Buffer, fileName: string): string {
	sweep();
	const id = randomUUID();
	processes.set(id, {
		id,
		file,
		fileName,
		skipPasses: [],
		status: { stage: 'starting', current: 0, total: 0, message: 'Запуск...' },
		createdAt: Date.now()
	});
	return id;
}

export function getProcess(id: string): ImportProcess | undefined {
	const p = processes.get(id);
	if (!p) return undefined;
	if (Date.now() - p.createdAt > TTL_MS) {
		processes.delete(id);
		return undefined;
	}
	return p;
}

export function setStatus(id: string, patch: Partial<ImportStatus>) {
	const p = processes.get(id);
	if (p) p.status = { ...p.status, ...patch };
}

export function setPicks(id: string, picks: ImportProcess['picks']) {
	const p = processes.get(id);
	if (p) p.picks = picks;
}

export function deleteProcess(id: string) {
	processes.delete(id);
}

/** Удалить процесс через delayMs — дать клиенту дочитать финальный статус */
export function scheduleDelete(id: string, delayMs = 5 * 60 * 1000) {
	setTimeout(() => deleteProcess(id), delayMs);
}
