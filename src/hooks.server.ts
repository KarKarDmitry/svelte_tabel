import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { redirect } from '@sveltejs/kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
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

	return resolve(event);
};

export const handle = sequence(handleBetterAuth, handleAuthGuard);
