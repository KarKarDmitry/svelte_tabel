import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';

/** Директория логов: <корень проекта>/logs/import */
const logDir = path.join(process.cwd(), 'logs', 'import');
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, `import_${new Date().toISOString().slice(0, 10)}.log`);
const stream = createWriteStream(logFile, { flags: 'a' });

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
	stream.write(`[${ts}] ${line}\n`);
}

export function logError(...args: unknown[]) {
	const line = formatArgs(args);
	const ts = new Date().toISOString();
	console.error(line);
	stream.write(`[${ts}] [ERROR] ${line}\n`);
}
