import { db } from '$lib/server/db';
import { departmentGroup } from '../tables/department-group';
import { departmentGroupMember } from '../tables/department-group-member';
import { department } from '../tables/department';
import { eq, and, asc, inArray } from 'drizzle-orm';

export const departmentGroupService = {
	list: () =>
		db
			.select()
			.from(departmentGroup)
			.orderBy(asc(departmentGroup.sortOrder), asc(departmentGroup.name)),

	getById: (id: number) =>
		db
			.select()
			.from(departmentGroup)
			.where(eq(departmentGroup.id, id))
			.then((r) => r[0]),

	create: (data: { name: string; sortOrder?: number }) =>
		db
			.insert(departmentGroup)
			.values(data)
			.returning()
			.then((r) => r[0]),

	update: (id: number, data: { name?: string; sortOrder?: number }) =>
		db
			.update(departmentGroup)
			.set(data)
			.where(eq(departmentGroup.id, id))
			.returning()
			.then((r) => r[0]),

	remove: (id: number) => db.delete(departmentGroup).where(eq(departmentGroup.id, id)),

	/** Получить все группы с подразделениями */
	listWithDepartments: async () => {
		const groups = await db
			.select()
			.from(departmentGroup)
			.orderBy(asc(departmentGroup.sortOrder), asc(departmentGroup.name));

		const members = await db
			.select({
				groupId: departmentGroupMember.groupId,
				departmentId: departmentGroupMember.departmentId,
				departmentName: department.name
			})
			.from(departmentGroupMember)
			.innerJoin(department, eq(department.id, departmentGroupMember.departmentId))
			.orderBy(asc(department.name));

		const memberMap = new Map<number, { departmentId: number; departmentName: string }[]>();
		for (const m of members) {
			if (!memberMap.has(m.groupId)) memberMap.set(m.groupId, []);
			memberMap
				.get(m.groupId)!
				.push({ departmentId: m.departmentId, departmentName: m.departmentName });
		}

		return groups.map((g) => ({ ...g, departments: memberMap.get(g.id) ?? [] }));
	},

	/** Добавить отдел в группу */
	addDepartment: (groupId: number, departmentId: number) =>
		db
			.insert(departmentGroupMember)
			.values({ groupId, departmentId })
			.onConflictDoNothing()
			.returning()
			.then((r) => r[0]),

	/** Удалить отдел из группы */
	removeDepartment: (groupId: number, departmentId: number) =>
		db
			.delete(departmentGroupMember)
			.where(
				and(
					eq(departmentGroupMember.groupId, groupId),
					eq(departmentGroupMember.departmentId, departmentId)
				)
			),

	/** Массовое добавление отделов в группу */
	addDepartments: (groupId: number, departmentIds: number[]) =>
		db
			.insert(departmentGroupMember)
			.values(departmentIds.map((departmentId) => ({ groupId, departmentId })))
			.onConflictDoNothing(),

	/** Массовое удаление отделов из группы */
	removeDepartments: (groupId: number, departmentIds: number[]) =>
		db
			.delete(departmentGroupMember)
			.where(
				and(
					eq(departmentGroupMember.groupId, groupId),
					inArray(departmentGroupMember.departmentId, departmentIds)
				)
			)
};
