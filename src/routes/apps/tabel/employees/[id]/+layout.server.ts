import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { getControlledDepartmentIds, isAdmin } from '$lib/server/permissions';

export const load: LayoutServerLoad = async (event) => {
	const id = Number(event.params.id);
	if (!id) throw error(400, 'Неверный ID');

	const emp = await employeeService.getById(id);
	if (!emp) throw error(404, 'Сотрудник не найден');

	const departments = await departmentService.list();
	const positions = await positionService.list();

	// Не-админ видит в диалогах только подконтрольные отделы;
	// полный список отделён в allDepartments для отображения
	const controlled = await getControlledDepartmentIds(event.locals.user);
	let controlledDepartments = departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		controlledDepartments = departments.filter((d) => set.has(d.id));
	}
	const allDepartments = departments;
	const dayMarks = await dayMarkService.list();
	const docs = await documentService.getByEmployee(id);
	const today = new Date();
	const lastDoc = await documentService.getActiveAtDate(id, today.toISOString().split('T')[0]);
	const isDismissed = lastDoc?.type === 'dismissal';

	// Право на редактирование именно этого сотрудника
	// (timekeeper — только если его отдел в подконтрольных)
	let canEditEmployee = false;
	if (isAdmin(event.locals.user)) {
		canEditEmployee = true;
	} else if (controlled !== null) {
		const controlledSet = new Set(controlled);
		let empDeptId: number | undefined;
		if (lastDoc && lastDoc.type !== 'dismissal') {
			empDeptId = lastDoc.departmentId;
		} else {
			// Уволенный — проверяем последний отдел из истории (до увольнения)
			const lastNonDismissal = docs.find((d) => d.type !== 'dismissal');
			empDeptId = lastNonDismissal?.departmentId;
		}
		canEditEmployee = !!empDeptId && controlledSet.has(empDeptId);
	}

	const scheduleHistory = await scheduleService.getHistoryByEmployee(id);
	const passHistory = await passService.getHistoryByEmployee(id);

	return {
		employee: emp,
		departments: controlledDepartments,
		allDepartments,
		positions,
		canEditEmployee,
		dayMarks,
		documents: docs,
		lastDoc,
		isDismissed,
		scheduleCount: scheduleHistory.length,
		passCount: passHistory.length
	};
};
