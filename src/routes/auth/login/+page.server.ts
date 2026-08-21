import { fail, redirect } from '@sveltejs/kit';
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

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	signIn: async (event) => {
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
		if (!limit.allowed) {
			return fail(429, {
				message: `Слишком много попыток входа. Попробуйте через ${limit.retryAfterSec} сек.`
			});
		}

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password
				}
			});
		} catch (error: any) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message });
			}
			return fail(500, {
				message: error?.message || error?.statusText || 'Неизвестная ошибка'
			});
		}

		clearRateLimit(`login:ip:${ip}:user:${email}`);
		return redirect(302, '/');
	}
};
