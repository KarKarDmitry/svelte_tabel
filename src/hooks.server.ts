import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { AppUser } from './app.d';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user as AppUser;
	}

	// Better-auth: перехватываем /api/auth/* напрямую (минуя svelteKitHandler,
	// который из-за запятых в ORIGIN ломал isAuthPath и давал 302).
	if (event.url.pathname.startsWith('/api/auth')) {
		return auth.handler(event.request);
	}

	return resolve(event);
};

// CSRF: для state-changing запросов проверяем Origin (встроенная защита SvelteKit
// покрывает только form content-types и блокирует запросы без Origin — ломает XP).
// Запросы без Origin пропускаем (XP/curl); запросы с несовпадающим Origin — 403.
const handleCsrf: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/auth')) {
		return resolve(event);
	}

	const method = event.request.method;
	if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
		return resolve(event);
	}

	const origin = event.request.headers.get('origin');
	if (origin) {
		// Разрешаем фактический Origin запроса (proto + Host от nginx), а не только
		// жёсткий ORIGIN из env — иначе доступ по IP/домену с портом (например
		// 192.168.1.42:8080 при ORIGIN=http://192.168.1.242 без порта) даёт 403
		// для всех state-changing запросов. Будущий mettem.apps:8080 тоже пройдёт.
		const proto =
			event.request.headers.get('x-forwarded-proto') || event.url.protocol.replace(':', '');
		const host = event.request.headers.get('host');
		const allowed = new Set([env.ORIGIN, event.url.origin, `${proto}://${host}`]);
		if (!allowed.has(origin)) {
			return new Response('Cross-site request forbidden', { status: 403 });
		}
	}

	return resolve(event);
};

const handleNativeMode: Handle = async ({ event, resolve }) => {
	const url = event.url;
	const q = url.searchParams.get('native_only');
	const header = event.request.headers.get('x-native-only');

	// Принудительно современная версия (одноразово, для этого запроса)
	if (q === '0') {
		const modern = url.pathname.replace(/^\/native\/apps/, '/apps');
		const search = url.searchParams;
		search.delete('native_only');
		throw redirect(303, modern + (search.toString() ? `?${search}` : ''));
	}

	// Принудительно нативная версия (тест с современного браузера)
	if (q === '1' || header === '1') {
		const native = url.pathname.replace(/^\/apps/, '/native/apps');
		const search = url.searchParams;
		search.delete('native_only');
		throw redirect(303, native + (search.toString() ? `?${search}` : ''));
	}

	// Автоопределение: Windows XP (NT 5.1 / 5.2) — User-Agent сообщает, что клиент старый
	const isXp = /Windows NT 5\.[12]/.test(event.request.headers.get('user-agent') ?? '');
	event.locals.nativeOnly = isXp;

	if (isXp && url.pathname.startsWith('/apps')) {
		throw redirect(303, url.pathname.replace(/^\/apps/, '/native/apps'));
	}

	return resolve(event);
};

const handleAuthGuard: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/auth') || event.url.pathname.startsWith('/_app')) {
		return resolve(event);
	}

	if (!event.locals.user) {
		throw redirect(302, '/auth/login');
	}

	// Админка доступна только администраторам
	if (event.url.pathname.startsWith('/admin') && event.locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	return resolve(event);
};

export const handle = sequence(handleBetterAuth, handleCsrf, handleNativeMode, handleAuthGuard);
