import { createWriteStream, mkdirSync, existsSync, type WriteStream } from 'fs';
import path from 'path';

/** Директория логов: <корень проекта>/logs/import */
const logDir = path.join(process.cwd(), 'logs', 'import');

let stream: WriteStream | null = null;
let streamLogFile = '';
let lastFileCheck = 0;

/** Проверяем существование файла не чаще раза в секунду — иначе stat на каждую строку лога */
const FILE_CHECK_INTERVAL = 1000;

function openStream(logFile: string): WriteStream {
	if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
	const s = createWriteStream(logFile, { flags: 'a' });
	s.on('error', (e) => {
		console.error('[logger] write error:', e.message);
		s.destroy();
		if (stream === s) stream = null;
	});
	return s;
}

function getStream(): WriteStream {
	const now = Date.now();
	const logFile = path.join(logDir, `import_${new Date().toISOString().slice(0, 10)}.log`);

	// Горячий путь: поток жив, файл/дата те же и недавно проверены — без системных вызовов
	if (
		stream &&
		!stream.destroyed &&
		streamLogFile === logFile &&
		now - lastFileCheck < FILE_CHECK_INTERVAL
	) {
		return stream;
	}

	// Холодный путь: раз в секунду убеждаемся, что файл на месте (мог быть удалён),
	// и что не сменилась дата
	lastFileCheck = now;
	if (stream && !stream.destroyed && streamLogFile === logFile && existsSync(logFile)) {
		return stream;
	}
	stream?.destroy();
	streamLogFile = logFile;
	stream = openStream(logFile);
	return stream;
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

/** Пишет в консоль и в файл-лог */
export function log(...args: unknown[]) {
	const line = formatArgs(args);
	const ts = new Date().toISOString();
	console.log(line);
	try {
		getStream().write(`[${ts}] ${line}\n`);
	} catch (e: any) {
		console.error('[logger] write failed:', e?.message ?? e);
	}
}

export function logError(...args: unknown[]) {
	const line = formatArgs(args);
	const ts = new Date().toISOString();
	console.error(line);
	try {
		getStream().write(`[${ts}] [ERROR] ${line}\n`);
	} catch (e: any) {
		console.error('[logger] write failed:', e?.message ?? e);
	}
}
