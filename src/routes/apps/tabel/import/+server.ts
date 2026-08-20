import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/permissions';
import {
	runTurnstileImport,
	resolvePassPicks,
	type ImportEvent
} from '$lib/server/db/apps/tabel/services/turnstile-import.service';

/* SSE helpers */
const enc = new TextEncoder();
function sse(data: unknown): Uint8Array {
	return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function makeThrottle(intervalMs = 200) {
	let last = 0;
	return {
		send(controller: ReadableStreamDefaultController, data: unknown) {
			const now = Date.now();
			if (now - last >= intervalMs) {
				last = now;
				controller.enqueue(sse(data));
			}
		},
		flush(controller: ReadableStreamDefaultController, data: unknown) {
			last = Date.now();
			controller.enqueue(sse(data));
		}
	};
}

/** Стадии, которые обязаны дойти до клиента (не троттлятся) */
const TERMINAL_STAGES = new Set(['error', 'unresolved', 'done']);

/** ФАЗА 1 + импорт — SSE stream (конвейер в turnstile-import.service) */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals.user);
	const fd = await request.formData();
	const file = fd.get('file') as File | null;
	if (!file) return json({ error: 'No file' });

	// Список пропусков, которые пользователь решил пропустить (из предыдущего unresolved)
	let skipPasses: { seria: string; number: string }[] = [];
	try {
		const raw = fd.get('skipPasses');
		if (raw) skipPasses = JSON.parse(raw as string);
	} catch {}

	let cancelled = false;

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: unknown) => {
				if (cancelled) return;
				controller.enqueue(sse(data));
			};
			const throttle = makeThrottle(200);
			const tSend = (data: unknown) => throttle.send(controller, data);
			const tFlush = (data: unknown) => throttle.flush(controller, data);

			// controller.signal доступен в современных рантаймах
			(controller as any).signal?.addEventListener('abort', () => {
				cancelled = true;
			});

			// Прогресс — через throttle, терминальные стадии и финальную сводку saving — сразу
			const emit = (ev: ImportEvent) => {
				if (cancelled) return;
				if (TERMINAL_STAGES.has(ev.stage) || (ev.stage === 'saving' && ev.current === ev.total)) {
					tFlush(ev);
				} else {
					tSend(ev);
				}
			};

			(async () => {
				try {
					await runTurnstileImport({
						file: Buffer.from(await file.arrayBuffer()),
						skipPasses,
						emit
					});
				} catch (e: any) {
					// Сервис сам шлёт stage:'error'; страховка на непойманную ошибку
					if (!cancelled) {
						send({ stage: 'error', message: e.message });
					}
				} finally {
					if (!cancelled) controller.close();
				}
			})();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			'x-accel-buffering': 'no'
		}
	});
};

/** ФАЗА 2: создание/переназначение пропусков (быстрая операция, без SSE) */
export const PUT: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals.user);
	try {
		const { unresolved } = (await request.json()) as { unresolved: any[] };
		const result = await resolvePassPicks(unresolved);
		return json({ stage: 'done', message: result.message, skipList: result.skipList });
	} catch (e: any) {
		return json({ stage: 'error', message: e.message });
	}
};
