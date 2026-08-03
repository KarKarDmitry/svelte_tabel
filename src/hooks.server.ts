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

const handleAuthGuard: Handle = async ({ event, resolve }) => {
	if (
		event.url.pathname.startsWith('/auth') ||
		event.url.pathname.startsWith('/setup') ||
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

export const handle = sequence(handleBetterAuth, handleAuthGuard);
