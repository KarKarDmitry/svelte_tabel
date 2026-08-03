import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { toEmail } from '$lib/server/auth-utils';
import { APIError } from 'better-auth/api';

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

		try {
			const result = await auth.api.signInEmail({
				body: {
					email: toEmail(username),
					password
				}
			});
			console.log('signIn result:', JSON.stringify(result));
		} catch (error: any) {
			console.error('signIn error:', error);
			if (error instanceof APIError) {
				return fail(400, { message: error.message });
			}
			return fail(500, {
				message: error?.message || error?.statusText || 'Неизвестная ошибка'
			});
		}

		return redirect(302, '/');
	}
};
