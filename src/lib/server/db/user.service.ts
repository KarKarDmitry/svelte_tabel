import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { eq } from 'drizzle-orm';

/** Работа с пользователями (auth-таблица) — только через сервис */
export const userService = {
	/** Все пользователи (для админки) */
	list: () =>
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				createdAt: user.createdAt
			})
			.from(user)
			.orderBy(user.createdAt),

	getById: (id: string) =>
		db
			.select()
			.from(user)
			.where(eq(user.id, id))
			.then((r) => r[0]),

	/** Количество администраторов */
	countAdmins: async () => {
		const rows = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin'));
		return rows.length;
	},

	updateRole: (id: string, role: string) => db.update(user).set({ role }).where(eq(user.id, id)),

	remove: (id: string) => db.delete(user).where(eq(user.id, id))
};
