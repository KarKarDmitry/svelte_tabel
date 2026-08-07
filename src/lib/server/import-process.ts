/** Хранилище фоновых процессов импорта (нативный режим): статус + файл */

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
	origin: string;
	cookie: string;
	skipPasses: { seria: string; number: string }[];
	picks?: { seria: string; number: string; employeeId: number }[];
	status: ImportStatus;
};

const processes = new Map<string, ImportProcess>();
let counter = 0;

export function createProcess(
	file: Buffer,
	fileName: string,
	origin: string,
	cookie: string
): string {
	const id = `${Date.now()}-${++counter}`;
	processes.set(id, {
		id,
		file,
		fileName,
		origin,
		cookie,
		skipPasses: [],
		status: { stage: 'starting', current: 0, total: 0, message: 'Запуск...' }
	});
	return id;
}

export function getProcess(id: string): ImportProcess | undefined {
	return processes.get(id);
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
