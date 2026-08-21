/**
 * Контроллеры справочников табеля: константы, отметки, пропуска,
 * подразделения, должности, группы подразделений.
 * Admin-only страницы (константы/пропуска/отметки) — guard-redirect в шеллах.
 */

import { db } from '$lib/server/db';
import { asc } from 'drizzle-orm';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { department } from '$lib/server/db/apps/tabel/tables/department';
import { denyIfNotAdmin, denyIfNoEdit } from '$lib/server/permissions';
import { ControllerError } from '$lib/server/context/controller';
import type { CtrlUser } from '$lib/server/context/controller';

/** ActionFailure из permissions → транспортно-нейтральная ошибка */
function assertAllowed(denied: ReturnType<typeof denyIfNoEdit>): void {
	if (denied) {
		throw new ControllerError(
			denied.status,
			(denied.data?.message as string) ?? 'Недостаточно прав'
		);
	}
}

// ---------- Loads ----------

export async function constantsData(url: URL) {
	const search = url.searchParams.get('search') || '';
	let items = await appConstantService.list();
	if (search) {
		const q = search.toLowerCase();
		items = items.filter(
			(c) => c.key.toLowerCase().includes(q) || c.value.toLowerCase().includes(q)
		);
	}
	return { constants: items, search };
}

export async function marksData(url: URL) {
	const search = url.searchParams.get('search') || '';
	let items = await dayMarkService.list();
	if (search) {
		const q = search.toLowerCase();
		items = items.filter(
			(m) =>
				m.name.toLowerCase().includes(q) ||
				m.shortName.toLowerCase().includes(q) ||
				m.code.toLowerCase().includes(q)
		);
	}
	return { dayMarks: items, search };
}

export async function passesData(url: URL) {
	const seriaSearch = url.searchParams.get('seria') || '';
	const numberSearch = url.searchParams.get('number') || '';
	let passes = await passService.listWithOwners();
	if (seriaSearch) {
		const q = seriaSearch.toLowerCase();
		passes = passes.filter((r: any) => r.pass.seria?.toLowerCase().includes(q));
	}
	if (numberSearch) {
		const q = numberSearch.toLowerCase();
		passes = passes.filter((r: any) => r.pass.number.toLowerCase().includes(q));
	}
	return { passes, seriaSearch, numberSearch };
}

export async function departmentsData(url: URL) {
	const search = url.searchParams.get('search') || '';
	let deps = await departmentService.list();
	if (search) {
		const q = search.toLowerCase();
		deps = deps.filter((d) => d.name.toLowerCase().includes(q));
	}
	return { departments: deps, search };
}

export async function positionsData(url: URL) {
	const search = url.searchParams.get('search') || '';
	let items = await positionService.list();
	if (search) items = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
	return { positions: items, search };
}

export async function departmentGroupsData() {
	const [groups, allDepts] = await Promise.all([
		departmentGroupService.listWithDepartments(),
		db.select().from(department).orderBy(asc(department.name))
	]);
	return { groups, allDepts };
}

// ---------- Константы (admin) ----------

export async function constantUpsert(user: CtrlUser, key: string, value: string) {
	assertAllowed(denyIfNotAdmin(user));
	if (!key) throw new ControllerError(400, 'Укажите ключ');
	await appConstantService.upsert(key, value);
}

export async function constantDelete(user: CtrlUser, key?: string) {
	assertAllowed(denyIfNotAdmin(user));
	if (!key) throw new ControllerError(400, 'Укажите ключ');
	await appConstantService.remove(key);
}

// ---------- Отметки (admin) ----------

export async function markCreate(user: CtrlUser, f: FormData) {
	assertAllowed(denyIfNotAdmin(user));
	await dayMarkService.create({
		name: f.get('name')?.toString() || '',
		shortName: f.get('shortName')?.toString() || '',
		code: f.get('code')?.toString() || '',
		category: f.get('category')?.toString() as any,
		reportExclude: f.get('reportExclude') === 'true'
	});
}

export async function markUpdate(user: CtrlUser, f: FormData) {
	assertAllowed(denyIfNotAdmin(user));
	await dayMarkService.update(Number(f.get('id')), {
		name: f.get('name')?.toString(),
		shortName: f.get('shortName')?.toString(),
		code: f.get('code')?.toString(),
		category: f.get('category')?.toString() as any,
		reportCode: f.get('reportCode')?.toString(),
		reportExclude: f.get('reportExclude') === 'true'
	});
}

export async function markDelete(user: CtrlUser, id: number) {
	assertAllowed(denyIfNotAdmin(user));
	await dayMarkService.remove(id);
}

// ---------- Пропуска (admin) ----------

export async function passCreate(user: CtrlUser, f: FormData) {
	assertAllowed(denyIfNotAdmin(user));
	const seria = f.get('seria')?.toString() || null;
	const number = f.get('number')?.toString();
	if (!number) throw new ControllerError(400, 'Номер обязателен');
	await passService.create({ seria, number });
}

export async function passUpdate(user: CtrlUser, f: FormData) {
	assertAllowed(denyIfNotAdmin(user));
	const id = Number(f.get('id'));
	const seria = f.get('seria')?.toString() || null;
	const number = f.get('number')?.toString();
	if (!number) throw new ControllerError(400, 'Номер обязателен');
	await passService.update(id, { seria, number });
}

export async function passDelete(user: CtrlUser, id: number) {
	assertAllowed(denyIfNotAdmin(user));
	await passService.remove(id);
}

// ---------- Подразделения ----------

export async function departmentCreate(user: CtrlUser, name?: string) {
	// Подразделения создаёт только администратор
	assertAllowed(denyIfNotAdmin(user));
	if (!name) throw new ControllerError(400, 'Название обязательно');
	await departmentService.create({ name });
}

export async function departmentUpdate(user: CtrlUser, id: number, name?: string) {
	// Название могут редактировать admin и timekeeper
	assertAllowed(denyIfNoEdit(user));
	if (!name) throw new ControllerError(400, 'Название обязательно');
	await departmentService.update(id, { name });
}

export async function departmentDelete(user: CtrlUser, id: number) {
	assertAllowed(denyIfNotAdmin(user));
	await departmentService.remove(id);
}

// ---------- Должности ----------

export async function positionCreate(user: CtrlUser, name?: string) {
	assertAllowed(denyIfNoEdit(user));
	if (!name) throw new ControllerError(400, 'Название обязательно');
	await positionService.create({ name });
}

export async function positionUpdate(user: CtrlUser, id: number, name?: string) {
	assertAllowed(denyIfNoEdit(user));
	if (!name) throw new ControllerError(400, 'Название обязательно');
	await positionService.update(id, { name });
}

export async function positionDelete(user: CtrlUser, id: number) {
	assertAllowed(denyIfNotAdmin(user));
	await positionService.remove(id);
}

// ---------- Группы подразделений ----------

export async function groupCreate(user: CtrlUser, f: FormData) {
	assertAllowed(denyIfNoEdit(user));
	await departmentGroupService.create({
		name: f.get('name')?.toString() || '',
		sortOrder: Number(f.get('sortOrder')) || 0
	});
}

export async function groupUpdate(user: CtrlUser, f: FormData) {
	assertAllowed(denyIfNoEdit(user));
	await departmentGroupService.update(Number(f.get('id')), {
		name: f.get('name')?.toString()
	});
}

export async function groupRemove(user: CtrlUser, id: number) {
	assertAllowed(denyIfNotAdmin(user));
	await departmentGroupService.remove(id);
}

export async function groupAddDept(user: CtrlUser, groupId: number, departmentId: number) {
	assertAllowed(denyIfNoEdit(user));
	await departmentGroupService.addDepartment(groupId, departmentId);
}

export async function groupRemoveDept(user: CtrlUser, groupId: number, departmentId: number) {
	assertAllowed(denyIfNoEdit(user));
	await departmentGroupService.removeDepartment(groupId, departmentId);
}

/** Синхронизация состава группы; false — группа не найдена */
export async function groupSaveDepts(
	user: CtrlUser,
	groupId: number,
	deptIds: number[]
): Promise<boolean> {
	assertAllowed(denyIfNoEdit(user));
	const groups = await departmentGroupService.listWithDepartments();
	const group = groups.find((g) => g.id === groupId);
	if (!group) return false;
	const existing = group.departments.map((d) => d.departmentId);
	const toRemove = existing.filter((id) => !deptIds.includes(id));
	const toAdd = deptIds.filter((id) => !existing.includes(id));
	if (toRemove.length) await departmentGroupService.removeDepartments(groupId, toRemove);
	if (toAdd.length) await departmentGroupService.addDepartments(groupId, toAdd);
	return true;
}
