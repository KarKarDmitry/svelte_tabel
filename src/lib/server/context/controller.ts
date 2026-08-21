/**
 * Инфраструктура контроллеров — общая для всех подприложений.
 *
 * Контроллеры (src/lib/server/apps/tabel/*) транспортно-нейтральны: принимают
 * нормализованный контекст и типизированные аргументы, бросают ControllerError,
 * возвращают обычные данные. Транспорт адаптируется на границе:
 *  - form action (+page.server.ts)  → runAction(): ControllerError → fail()
 *  - JSON-эндпоинт (+server.ts/api) → readJson()/json(): статус и payload из ошибки
 */

import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/** Минимальная форма пользователя для контроллеров (структурно совместима с AppUser) */
export type CtrlUser =
	| {
			id: string;
			role: string;
			name?: string | null;
			email?: string | null;
	  }
	| null
	| undefined;

/** Контекст запроса, нормализованный для контроллеров */
export type CtrlCtx = {
	user: CtrlUser;
	params: Record<string, string>;
	url: URL;
};

/** Контроллер → контекст из события SvelteKit (load/action/+server) */
export function ctxFrom(event: RequestEvent): CtrlCtx {
	return { user: event.locals.user as CtrlUser, params: event.params, url: event.url };
}

/**
 * Транспортно-нейтральная ошибка контроллера. В form actions превращается
 * в fail(status, payload), в JSON-эндпоинтах — в ответ с тем же статусом.
 */
export class ControllerError extends Error {
	status: number;
	payload: Record<string, unknown>;

	constructor(status: number, message: string, payload?: Record<string, unknown>) {
		super(message);
		this.name = 'ControllerError';
		this.status = status;
		this.payload = { message, ...payload };
	}
}

/** Обёртка form action: ControllerError → fail(), прочие исключения — наружу */
export async function runAction<T>(fn: () => Promise<T>): Promise<T | ReturnType<typeof fail>> {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof ControllerError) return fail(e.status, e.payload);
		throw e;
	}
}

/** Парсинг JSON-тела запроса; некорректный JSON → 400 */
export async function readJson(request: Request): Promise<Record<string, any>> {
	try {
		return (await request.json()) as Record<string, any>;
	} catch {
		throw new ControllerError(400, 'Некорректный JSON');
	}
}

/** Строковое поле формы/JSON (trim); не-строка → '' */
export const strField = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Числовое поле; пустое/нечисловое → null */
export const numField = (v: unknown): number | null => {
	if (v == null || v === '') return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
};
