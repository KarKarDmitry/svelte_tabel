import { fail, error } from '@sveltejs/kit';
import { masterService } from '$lib/server/db/apps/tabel/services/master.service';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';

type PermUser = { id: string; role: string } | null | undefined;

/** Администратор видит и редактирует всё */
export const isAdmin = (user: PermUser): boolean => user?.role === 'admin';

/** Может изменять данные: admin или timekeeper */
export const canEdit = (user: PermUser): boolean =>
	user?.role === 'admin' || user?.role === 'timekeeper';

/**
 * Для actions (+page.server.ts): возвращает fail(403), если пользователь
 * не имеет права записи, иначе null.
 */
export const denyIfNoEdit = (user: PermUser) =>
	canEdit(user) ? null : fail(403, { message: 'Недостаточно прав для редактирования' });

/**
 * Для actions (+page.server.ts): возвращает fail(403), если пользователь
 * не администратор, иначе null.
 */
export const denyIfNotAdmin = (user: PermUser) =>
	isAdmin(user) ? null : fail(403, { message: 'Требуются права администратора' });

/** Для API (+server.ts): бросает error(403), если нет права записи */
export const requireEdit = (user: PermUser): void => {
	if (!canEdit(user)) throw error(403, 'Недостаточно прав для редактирования');
};

/** Для API (+server.ts): бросает error(403), если пользователь не администратор */
export const requireAdmin = (user: PermUser): void => {
	if (!isAdmin(user)) throw error(403, 'Требуются права администратора');
};

/**
 * Для действий с сотрудником: admin — всегда, timekeeper — только если
 * отдел сотрудника (или переданный deptId) в подконтрольных.
 * Если deptId передан (перевод/приём/повторный приём) — проверяется именно он.
 * Возвращает fail(403) или null.
 */
export async function denyIfCannotEditEmployee(
	user: PermUser,
	employeeId: number,
	deptId?: number
) {
	if (!canEdit(user)) return fail(403, { message: 'Недостаточно прав для редактирования' });
	if (isAdmin(user)) return null;
	const controlled = await getControlledDepartmentIds(user);
	let dept: number | undefined = deptId;
	if (!dept) {
		// Создание сотрудника без подразделения («Ожидание») разрешено табельщику
		if (employeeId === 0) return null;
		const dep = await employeeService.getDepartmentAtDate(
			employeeId,
			new Date().toISOString().split('T')[0]
		);
		dept = dep?.id;
	}
	if (!dept) {
		// Сотрудник без активного подразделения: табельщику доступны только
		// «ожидающие» (ещё не было ни одного кадрового документа)
		const docs = await documentService.getByEmployee(employeeId);
		if (docs.length === 0) return null;
	}
	if (!dept || !controlled?.includes(dept)) {
		return fail(403, { message: 'Это подразделение вам не подконтрольно' });
	}
	return null;
}

/**
 * ID подконтрольных пользователю подразделений.
 * null — все (admin), [] — ничего (не назначено).
 */
export async function getControlledDepartmentIds(user: PermUser): Promise<number[] | null> {
	if (!user) return [];
	if (isAdmin(user)) return null;
	const rows = await masterService.getActiveByUser(user.id);
	return rows.map((m) => m.departmentId);
}

/** Подконтрольно ли подразделение пользователю (для admin — всегда да) */
export async function isDepartmentControlled(
	user: PermUser,
	departmentId: number
): Promise<boolean> {
	const ids = await getControlledDepartmentIds(user);
	return ids === null || ids.includes(departmentId);
}

/**
 * Слой прав на чтение (для load +page.server.ts / +layout.server.ts):
 * бросает error(403), если сотрудник вне подконтрольных пользователю
 * подразделений. admin — всегда разрешено; «ожидающие» (без кадровых
 * документов) — видны всем залогиненным.
 */
export async function requireCanReadEmployee(
	user: PermUser,
	employeeId: number,
	date?: string
): Promise<void> {
	if (isAdmin(user)) return;
	const controlled = await getControlledDepartmentIds(user);
	const d = date ?? new Date().toISOString().split('T')[0];
	const dept = await employeeService.getDepartmentAtDate(employeeId, d);
	if (dept) {
		if (controlled?.includes(dept.id)) return;
		throw error(403, 'Нет доступа к данным этого сотрудника');
	}
	// Уволенный / без активного отдела — проверяем последний не-dismissal отдел
	const docs = await documentService.getByEmployee(employeeId);
	if (docs.length === 0) return; // «ожидающий»
	const lastNonDismissal = docs.find((x) => x.type !== 'dismissal');
	if (lastNonDismissal && controlled?.includes(lastNonDismissal.departmentId)) return;
	throw error(403, 'Нет доступа к данным этого сотрудника');
}
