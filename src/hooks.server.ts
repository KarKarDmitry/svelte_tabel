import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { redirect } from '@sveltejs/kit';
import type { AppUser } from './app.d';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user as AppUser;
	}

	return svelteKitHandler({ event, resolve, auth, building });
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
	if (
		event.url.pathname.startsWith('/auth') ||
		event.url.pathname.startsWith('/_app')
	) {
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

export const handle = sequence(handleBetterAuth, handleNativeMode, handleAuthGuard);
