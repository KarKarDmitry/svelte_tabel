import path from 'path';
import pino from 'pino';

/**
 * Асинхронный логгер импорта на pino (SonicBoom, без worker-потоков).
 * Без console.log: запись идёт напрямую в файл батчами, не блокируя конвейер.
 * Ротация по дням (файл на дату) — пересоздание destination при смене даты.
 */

const logDir = path.join(process.cwd(), 'logs', 'import');

let dest: ReturnType<typeof pino.destination> | null = null;
let currentDate = '';
let logger: pino.Logger | null = null;

function getLogger(): pino.Logger {
	const today = new Date().toISOString().slice(0, 10);
	if (!logger || !dest || currentDate !== today) {
		dest?.end();
		currentDate = today;
		dest = pino.destination({
			dest: path.join(logDir, `import_${today}.log`),
			minLength: 4096,
			sync: false,
			mkdir: true
		});
		// Дефолт 'info' — ничего не отбрасывается. Уровень можно поднять через IMPORT_LOG_LEVEL
		const level = (process.env.IMPORT_LOG_LEVEL ?? 'info') as pino.Level;
		logger = pino({ level }, dest);
	}
	return logger;
}

function formatArgs(args: unknown[]): string {
	return args
		.map((a) => {
			if (typeof a === 'string') return a;
			try {
				return JSON.stringify(a);
			} catch {
				return String(a);
			}
		})
		.join(' ');
}

/** Пишет строку в файл-лог импорта (JSONL) */
export function log(...args: unknown[]) {
	getLogger().info(formatArgs(args));
}

export function logError(...args: unknown[]) {
	getLogger().error(formatArgs(args));
}

/**
 * Принудительно сбрасывает буфер в файл (SonicBoom с minLength пишет только
 * по накоплению или по таймеру — при коротком импорте данные могут не попасть
 * в файл). Вызывается по завершении импорта/разрешения, чтобы гарантировать запись.
 */
export function flushImportLog() {
	try {
		dest?.flushSync();
	} catch {
		// файл лога — best effort, не роняем импорт
	}
}
