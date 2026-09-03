import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { toEmail } from '$lib/server/auth-utils';
import { checkRateLimit, clearRateLimit } from '$lib/server/utils/rate-limit';
import { APIError } from 'better-auth/api';

// Лимиты: 5 попыток на (IP + логин) за 15 мин; агрегатно 20 попыток с IP за 15 мин.
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const PER_USER_MAX = 5;
const PER_IP_MAX = 20;

type SignResult =
	| { kind: 'ok'; token: string }
	| { kind: 'limit'; retryAfterSec: number }
	| { kind: 'fail'; status: number; message: string };

/** Общая часть входа: форма -> toEmail (punycode-нормализация) -> rate-limit -> signInEmail. */
async function doSignIn(event: RequestEvent): Promise<SignResult> {
	const formData = await event.request.formData();
	const username = formData.get('username')?.toString() ?? '';
	const password = formData.get('password')?.toString() ?? '';
	const email = toEmail(username);

	const ip = event.getClientAddress();
	const perIp = checkRateLimit(`login:ip:${ip}`, {
		max: PER_IP_MAX,
		windowMs: WINDOW_MS,
		lockMs: LOCK_MS
	});
	const perUser = checkRateLimit(`login:ip:${ip}:user:${email}`, {
		max: PER_USER_MAX,
		windowMs: WINDOW_MS,
		lockMs: LOCK_MS
	});
	const limit = !perIp.allowed ? perIp : perUser;
	if (!limit.allowed) return { kind: 'limit', retryAfterSec: limit.retryAfterSec };

	try {
		const result = await auth.api.signInEmail({
			body: { email, password }
		});
		clearRateLimit(`login:ip:${ip}:user:${email}`);
		return { kind: 'ok', token: result.token };
	} catch (error: any) {
		if (error instanceof APIError) return { kind: 'fail', status: 400, message: error.message };
		return {
			kind: 'fail',
			status: 500,
			message: error?.message || error?.statusText || 'Неизвестная ошибка'
		};
	}
}

const limitMessage = (sec: number) =>
	`Слишком много попыток входа. Попробуйте через ${sec} сек.`;

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	// Браузерный вход: редирект на главную.
	signIn: async (event) => {
		const r = await doSignIn(event);
		if (r.kind === 'ok') return redirect(302, '/');
		if (r.kind === 'limit') return fail(429, { message: limitMessage(r.retryAfterSec) });
		return fail(r.status, { message: r.message });
	},
	// Токен-вход для автономного вьювера (client/tabel-viewer): то же, что signIn.
	// Кука сессии ставится на ответ автоматически; вьювер берёт токен из Set-Cookie.
	signInToken: async (event) => {
		const r = await doSignIn(event);
		if (r.kind === 'ok') return { success: true };
		if (r.kind === 'limit') return fail(429, { message: limitMessage(r.retryAfterSec) });
		return fail(r.status, { message: r.message });
	}
};
