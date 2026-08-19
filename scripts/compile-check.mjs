// Быстрая проверка компиляции: .svelte через svelte/compiler, .ts через TS transpileModule.
// Не проверяет типы (для этого есть npm run check / svelte-check) — только синтаксис.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');

const isCheckable = (p) =>
	(p.endsWith('.svelte') || p.endsWith('.ts')) && !p.endsWith('.d.ts');

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		const st = statSync(p);
		if (st.isDirectory()) {
			walk(p, out);
		} else if (isCheckable(p)) {
			out.push(p);
		}
	}
	return out;
}

// Парсим аргументы: -f <file-path> — проверить только один файл
let singleFile = null;
for (let i = 2; i < process.argv.length; i++) {
	if (process.argv[i] === '-f' && process.argv[i + 1]) {
		singleFile = resolve(process.argv[i + 1]);
		i++;
	}
}

let files;
if (singleFile) {
	if (!existsSync(singleFile)) {
		console.error(`[error] Файл не найден: ${singleFile}`);
		process.exit(1);
	}
	if (!isCheckable(singleFile)) {
		console.error(`[error] Неподдерживаемый тип файла (ожидается .svelte или .ts): ${singleFile}`);
		process.exit(1);
	}
	files = [singleFile];
} else {
	files = walk(srcDir);
}
let errors = 0;
let warnings = 0;

for (const file of files) {
	const rel = relative(srcDir, file);
	const source = readFileSync(file, 'utf8');
	try {
		if (file.endsWith('.svelte')) {
			const result = compile(source, { filename: file, generate: 'client' });
			for (const warn of result.warnings ?? []) {
				warnings++;
				const line = warn.start?.line ?? '?';
				console.log(`[warn] ${rel}:${line} ${warn.code}: ${warn.message}`);
			}
		} else {
			const out = ts.transpileModule(source, {
				compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
				fileName: file,
				reportDiagnostics: true
			});
			for (const d of out.diagnostics ?? []) {
				if (d.category !== ts.DiagnosticCategory.Error) continue;
				errors++;
				const pos = d.file ? d.file.getLineAndCharacterOfPosition(d.start ?? 0) : null;
				const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
				console.log(`[error] ${rel}${pos ? `:${pos.line + 1}` : ''}: ${msg}`);
			}
		}
	} catch (e) {
		errors++;
		console.log(`[error] ${rel}: ${e?.message ?? e}`);
		if (e?.frame) console.log(e.frame);
	}
}

console.log(
	`\nПроверено файлов: ${files.length}, ошибок: ${errors}, предупреждений: ${warnings}`
);
process.exit(errors > 0 ? 1 : 0);