import type { PageServerLoad, Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { updateProfileAction, changePasswordAction } from '$lib/server/user-account';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) throw redirect(302, '/auth/login');
	return {};
};

export const actions: Actions = {
	updateProfile: async (event) =>
		updateProfileAction(event.locals.user, await event.request.formData()),
	changePassword: async (event) =>
		changePasswordAction(event.locals.user, await event.request.formData(), event.request.headers)
};
