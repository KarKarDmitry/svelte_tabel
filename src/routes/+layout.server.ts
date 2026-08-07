import type { LayoutServerLoad } from './$types';
import { canEdit } from '$lib/server/permissions';

export const load: LayoutServerLoad = (event) => {
	return {
		user: event.locals.user
			? {
					id: event.locals.user.id,
					name: event.locals.user.name,
					email: event.locals.user.email,
					role: event.locals.user.role
				}
			: null,
		isAdmin: event.locals.user?.role === 'admin',
		canEdit: canEdit(event.locals.user)
	};
};
