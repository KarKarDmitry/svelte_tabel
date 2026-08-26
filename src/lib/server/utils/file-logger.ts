import path from 'path';
import pino from 'pino';

/**
 * Фабрика файловых логгеров на pino (SonicBoom, без worker-потоков).
 * Запись идёт напрямую в файл батчами, не блокируя вызывающий код.
 * Ротация по дням (файл на дату) — пересоздание destination при смене даты.
 *
 * Правило проекта: новые файловые логгеры создавать только через эту фабрику,
 * pino.destination вручную не использовать.
 */

export type FileLogger = {
	debug: (...args: unknown[]) => void;
	info: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
	/** Принудительный сброс буфера на диск (best effort, не бросает) */
	flush: () => void;
	/**
	 * Периодический снапшот: каждые sec секунд пишется результат fn().
	 * Таймер с unref — не удерживает процесс. Повторный вызов заменяет fn.
	 */
	schedule: (fn: () => Record<string, unknown> | string, sec: number) => void;
};

type State = {
	dest: ReturnType<typeof pino.destination> | null;
	currentDate: string;
	logger: pino.Logger | null;
	timer: NodeJS.Timeout | null;
	intervalFn: (() => Record<string, unknown> | string) | null;
};

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

export function createFileLogger(opts: {
	/** Префикс файла и имя логгера */
	name: string;
	/** Подпапка; по умолчанию logs/<name> */
	dir?: string;
	/** Уровень по умолчанию; override из env: <NAME>_LOG_LEVEL (upper-case) */
	level?: string;
	/** Буфер SonicBoom в байтах: запись на диск после накопления; 1 — писать сразу */
	minLength?: number;
}): FileLogger {
	const logDir = path.join(process.cwd(), 'logs', opts.dir ?? opts.name);
	const envLevel = process.env[`${opts.name.toUpperCase()}_LOG_LEVEL`];
	const level = (envLevel ?? opts.level ?? 'info') as pino.Level;
	const minLength = opts.minLength ?? 4096;

	const state: State = { dest: null, currentDate: '', logger: null, timer: null, intervalFn: null };

	function getLogger(): pino.Logger {
		const today = new Date().toISOString().slice(0, 10);
		if (!state.logger || !state.dest || state.currentDate !== today) {
			state.dest?.end();
			state.currentDate = today;
			state.dest = pino.destination({
				dest: path.join(logDir, `${opts.name}_${today}.log`),
				minLength,
				sync: false,
				mkdir: true
			});
			state.logger = pino({ level }, state.dest);
		}
		return state.logger;
	}

	return {
		debug: (...args) => getLogger().debug(formatArgs(args)),
		info: (...args) => getLogger().info(formatArgs(args)),
		warn: (...args) => getLogger().warn(formatArgs(args)),
		error: (...args) => getLogger().error(formatArgs(args)),
		flush: () => {
			try {
				state.dest?.flushSync();
			} catch {
				// файл лога — best effort
			}
		},
		schedule: (fn, sec) => {
			state.intervalFn = fn;
			if (state.timer) clearInterval(state.timer);
			if (!(sec > 0)) return;
			state.timer = setInterval(() => {
				try {
					const snap = state.intervalFn?.();
					if (snap == null) return;
					getLogger().info(`[stats] ${typeof snap === 'string' ? snap : JSON.stringify(snap)}`);
				} catch {
					// лог статистики не должен падать
				}
			}, sec * 1000);
			state.timer.unref?.();
		}
	};
}
