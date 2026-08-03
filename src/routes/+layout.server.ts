import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	return {
		user: event.locals.user
			? {
					id: event.locals.user.id,
					name: event.locals.user.name,
					email: event.locals.user.email
				}
			: null,
		isAdmin: event.locals.user?.role === 'admin'
	};
};
