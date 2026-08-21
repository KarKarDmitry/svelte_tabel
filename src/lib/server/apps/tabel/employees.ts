/**
 * Контроллеры секции «Сотрудники»: layout, основная карточка, кадровые
 * документы, графики, пропуска, события турникета. Логика идентична для обоих
 * деревьев (/apps и /native/apps); исходные файлы перенесены дословно.
 */

import { error } from '@sveltejs/kit';
import type { ActionFailure } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { departmentService } from '$lib/server/db/apps/tabel/services/department.service';
import { positionService } from '$lib/server/db/apps/tabel/services/position.service';
import { dayMarkService } from '$lib/server/db/apps/tabel/services/day-mark.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { turnstileEventTrackerService } from '$lib/server/db/apps/tabel/services/turnstile-event-tracker.service';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';
import {
	getControlledDepartmentIds,
	isAdmin,
	requireCanReadEmployee,
	denyIfCannotEditEmployee,
	denyIfNoEdit
} from '$lib/server/permissions';
import { ControllerError } from '$lib/server/context/controller';
import type { CtrlUser } from '$lib/server/context/controller';

const todayStr = () => new Date().toISOString().split('T')[0];

/** ActionFailure из permissions → транспортно-нейтральная ошибка */
function assertAllowed(denied: ActionFailure<Record<string, any>> | null): void {
	if (denied) {
		throw new ControllerError(403, (denied.data?.message as string) ?? 'Недостаточно прав');
	}
}

// ---------- Loads ----------

/** Layout сотрудника: общие данные + права (все подстраницы) */
export async function employeeLayoutData(user: CtrlUser, id: number) {
	if (!id) throw error(400, 'Неверный ID');

	const emp = await employeeService.getById(id);
	if (!emp) throw error(404, 'Сотрудник не найден');

	// Слой прав на чтение: не-админ — только подконтрольные подразделения
	await requireCanReadEmployee(user, id);

	const departments = await departmentService.list();
	const positions = await positionService.list();

	// Не-админ видит в диалогах только подконтрольные отделы;
	// полный список отделён в allDepartments для отображения
	const controlled = await getControlledDepartmentIds(user);
	let controlledDepartments = departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		controlledDepartments = departments.filter((d) => set.has(d.id));
	}
	const allDepartments = departments;
	const dayMarks = await dayMarkService.list();
	const docs = await documentService.getByEmployee(id);
	const lastDoc = await documentService.getActiveAtDate(id, todayStr());
	const isDismissed = lastDoc?.type === 'dismissal';

	// Право на редактирование именно этого сотрудника
	// (timekeeper — только если его отдел в подконтрольных)
	let canEditEmployee = false;
	if (isAdmin(user)) {
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
		canEditEmployee = empDeptId ? controlledSet.has(empDeptId) : docs.length === 0;
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
}

/** События турникета сотрудника за месяц */
export async function employeeEventsData(id: number, year?: number, month?: number) {
	const y = year || new Date().getFullYear();
	const m = month || new Date().getMonth() + 1;

	const periodStart = new Date(y, m - 1, 1);
	const periodEnd = new Date(y, m, 0, 23, 59, 59);

	const [events, eventTypes] = await Promise.all([
		turnstileEventTrackerService.getByPeriodWithDetails(id, periodStart, periodEnd),
		db.select().from(turnstileEvent)
	]);

	return { events, eventTypes, year: y, month: m };
}

/** История графиков сотрудника + справочник */
export async function employeeScheduleData(id: number) {
	const [scheduleHistory, allSchedules] = await Promise.all([
		scheduleService.getHistoryByEmployee(id),
		scheduleService.list()
	]);
	return { scheduleHistory, allSchedules };
}

/** История пропусков сотрудника + справочник + занятые пропуска */
export async function employeePassData(id: number) {
	const [passHistory, allPasses, activeAssignments] = await Promise.all([
		passService.getHistoryByEmployee(id),
		passService.list(),
		passService.listActiveAssignments()
	]);

	// Пропуска, назначенные другим сотрудникам — недоступны для выбора
	const occupiedPassIds = new Set(
		activeAssignments.filter((a: any) => a.employeeId !== id).map((a: any) => a.passId)
	);

	return { passHistory, allPasses, occupiedPassIds: [...occupiedPassIds] };
}

// ---------- Actions: основная карточка ----------

export async function employeeMainUpdate(user: CtrlUser, id: number, form: FormData) {
	assertAllowed(await denyIfCannotEditEmployee(user, id));
	const number = form.get('number')?.toString() || undefined;

	// Номер занят другим сотрудником — подсказываем, что делать
	if (number) {
		const existing = await employeeService.getByNumber(number);
		if (existing && existing.id !== id) {
			throw new ControllerError(409, 'Номер уже занят', {
				error: 'number_taken',
				existing: {
					id: existing.id,
					number: existing.number,
					lastName: existing.lastName,
					firstName: existing.firstName,
					middleName: existing.middleName
				}
			});
		}
	}

	await employeeService.update(id, {
		lastName: form.get('lastName')?.toString() || undefined,
		firstName: form.get('firstName')?.toString() || undefined,
		middleName: form.get('middleName')?.toString() || undefined,
		number: form.get('number')?.toString() || undefined
	});
}

export async function employeeHire(user: CtrlUser, id: number, form: FormData) {
	assertAllowed(await denyIfCannotEditEmployee(user, id, Number(form.get('departmentId'))));
	await documentService.create({
		type: 'hiring',
		date: form.get('date')?.toString() || todayStr(),
		docNumber: form.get('docNumber')?.toString() || null,
		employeeId: id,
		departmentId: Number(form.get('departmentId')),
		positionId: Number(form.get('positionId'))
	});
}

// ---------- Actions: кадровые документы ----------

export async function docRehire(user: CtrlUser, id: number, form: FormData) {
	const newDeptId = Number(form.get('departmentId'));
	let denied = await denyIfCannotEditEmployee(user, id, newDeptId);
	// Уволенного можно принять повторно, если он работал в подконтрольном отделе
	if (denied && user?.role !== 'admin') {
		const docs = await documentService.getByEmployee(id);
		// getByEmployee сортирует по дате DESC — первый не-dismissal и есть последний
		const lastNonDismissal = docs.find((d) => d.type !== 'dismissal');
		if (lastNonDismissal) {
			const controlled = await getControlledDepartmentIds(user);
			if (controlled?.includes(lastNonDismissal.departmentId)) denied = null;
		}
	}
	assertAllowed(denied);
	await documentService.create({
		type: 'hiring',
		date: form.get('date')?.toString() || '',
		docNumber: form.get('docNumber')?.toString() || null,
		employeeId: id,
		departmentId: newDeptId,
		positionId: Number(form.get('positionId'))
	});
}

export async function docTransfer(user: CtrlUser, id: number, form: FormData) {
	// Перевод разрешён только в подконтрольные подразделения
	assertAllowed(await denyIfCannotEditEmployee(user, id, Number(form.get('departmentId'))));
	await documentService.create({
		type: 'transfer',
		date: form.get('date')?.toString() || '',
		docNumber: form.get('docNumber')?.toString() || null,
		employeeId: id,
		departmentId: Number(form.get('departmentId')),
		positionId: Number(form.get('positionId'))
	});
}

export async function docDismiss(user: CtrlUser, id: number, form: FormData) {
	assertAllowed(await denyIfCannotEditEmployee(user, id));
	const date = form.get('date')?.toString() || todayStr();
	const lastDoc = await documentService.getActiveAtDate(id, todayStr());
	await documentService.create({
		type: 'dismissal',
		date,
		docNumber: form.get('docNumber')?.toString() || null,
		employeeId: id,
		departmentId: lastDoc?.departmentId ?? 0,
		positionId: lastDoc?.positionId ?? 0
	});
	// Снимаем текущие пропуска и графики с даты увольнения
	await passService.closeCurrent(id, date);
	await scheduleService.closeCurrentSchedule(id, date);
}

export async function docCancel(user: CtrlUser, docId: number) {
	const doc = await documentService.getById(docId);
	// Проверка по отделу из документа (для увольнения — отдел до увольнения),
	// чтобы табельщик мог отменить ошибочное увольнение
	assertAllowed(
		doc
			? await denyIfCannotEditEmployee(user, doc.employeeId, doc.departmentId)
			: denyIfNoEdit(user)
	);
	await documentService.remove(docId);
}

// ---------- Actions: графики сотрудника ----------

export async function scheduleAssign(user: CtrlUser, employeeId: number, form: FormData) {
	assertAllowed(await denyIfCannotEditEmployee(user, employeeId));
	const scheduleId = Number(form.get('scheduleId'));
	const dateFrom = form.get('dateFrom')?.toString() || todayStr();

	await scheduleService.assignToEmployee({ employeeId, scheduleId, dateFrom });
}

export async function scheduleUpdate(user: CtrlUser, form: FormData) {
	const id = Number(form.get('id'));
	const rec = await scheduleService.getEmployeeScheduleById(id);
	assertAllowed(rec ? await denyIfCannotEditEmployee(user, rec.employeeId) : denyIfNoEdit(user));
	const scheduleId = Number(form.get('scheduleId'));
	const dateFrom = form.get('dateFrom')?.toString();
	const dateToRaw = form.get('dateTo')?.toString();
	const dateTo = dateToRaw ? dateToRaw : null;
	await scheduleService.updateEmployeeSchedule(id, { scheduleId, dateFrom, dateTo });
}

export async function scheduleRemove(user: CtrlUser, recordId: number) {
	const rec = await scheduleService.getEmployeeScheduleById(recordId);
	assertAllowed(rec ? await denyIfCannotEditEmployee(user, rec.employeeId) : denyIfNoEdit(user));
	// «Открепить» — закрываем период (dateTo = сегодня), запись остаётся в истории
	await scheduleService.unassignFromEmployee(recordId, todayStr());
}

export async function scheduleDeleteRecord(user: CtrlUser, recordId: number) {
	const rec = await scheduleService.getEmployeeScheduleById(recordId);
	assertAllowed(rec ? await denyIfCannotEditEmployee(user, rec.employeeId) : denyIfNoEdit(user));
	// Полное удаление записи назначения (для откреплённых графиков)
	await scheduleService.removeEmployeeSchedule(recordId);
}

// ---------- Actions: пропуска сотрудника ----------

/** Возвращает 'occupied', если пропуск уже у другого сотрудника (исходы деревьев различаются) */
export async function passAssign(
	user: CtrlUser,
	employeeId: number,
	form: FormData
): Promise<'ok' | 'occupied'> {
	assertAllowed(await denyIfCannotEditEmployee(user, employeeId));
	const passId = Number(form.get('passId'));
	const dateFrom = form.get('dateFrom')?.toString() || todayStr();

	// Проверяем, не занят ли пропуск другим сотрудником
	const existing = await passService.getActiveAssignment(passId);
	if (existing && existing.employeeId !== employeeId) {
		return 'occupied';
	}

	// Закрываем текущий активный пропуск сотрудника (если есть)
	const today = todayStr();
	await passService.closeCurrent(employeeId, today);

	await passService.assignToEmployee({ employeeId, passId, dateFrom });
	return 'ok';
}

export async function passRemove(user: CtrlUser, recordId: number) {
	const rec = await passService.getEmployeePassById(recordId);
	assertAllowed(rec ? await denyIfCannotEditEmployee(user, rec.employeeId) : denyIfNoEdit(user));
	await passService.closeEmployeePass(recordId, todayStr());
}

// ---------- Список сотрудников ----------

const PAGE_SIZE = 100;

/** Список сотрудников с фильтрами (не-админ — только подконтрольные отделы) */
export async function employeesListData(user: CtrlUser, url: URL) {
	// Не-админ видит только сотрудников подконтрольных подразделений
	const departmentIds = await getControlledDepartmentIds(user);

	const result = await employeeService.searchWithFilters({
		search: url.searchParams.get('search') || '',
		department: url.searchParams.get('department') || '',
		position: url.searchParams.get('position') || '',
		status: url.searchParams.get('status') || '',
		departmentIds,
		sort: url.searchParams.get('sort') || 'lastName',
		order: url.searchParams.get('order') || 'asc',
		page: Math.max(1, Number(url.searchParams.get('page')) || 1),
		pageSize: PAGE_SIZE
	});

	const [departments, positions] = await Promise.all([
		departmentService.list(),
		positionService.list()
	]);

	return {
		...result,
		totalPages: Math.ceil(result.total / PAGE_SIZE),
		page: Math.max(1, Number(url.searchParams.get('page')) || 1),
		departments,
		positions,
		search: url.searchParams.get('search') || '',
		department: url.searchParams.get('department') || '',
		position: url.searchParams.get('position') || '',
		status: url.searchParams.get('status') || ''
	};
}

/** Полное удаление сотрудника (каскадом) — только для администраторов */
export async function employeeDelete(user: CtrlUser, id: number) {
	if (!isAdmin(user)) {
		throw new ControllerError(403, 'Требуются права администратора');
	}
	if (!id) throw new ControllerError(400, 'Неверный ID сотрудника');
	// FK в БД (hr_document, employee_pass, employee_schedule, leave_document,
	// worktime_tracker, turnstile_event_tracker) имеют ON DELETE CASCADE
	await employeeService.remove(id);
}

// ---------- Создание сотрудника ----------

/** Справочники страницы создания (табельщик — подконтрольные отделы) */
export async function employeeCreateData(user: CtrlUser) {
	const [departments, positions] = await Promise.all([
		departmentService.list(),
		positionService.list()
	]);
	// Табельщик видит только подконтрольные отделы (админ — все)
	const controlled = await getControlledDepartmentIds(user);
	let visibleDepartments = departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		visibleDepartments = departments.filter((d) => set.has(d.id));
	}
	return { departments: visibleDepartments, positions };
}

/** Создание сотрудника (+ приём, если заданы отдел и должность). Возвращает созданного. */
export async function employeeCreate(user: CtrlUser, form: FormData) {
	assertAllowed(await denyIfCannotEditEmployee(user, 0, Number(form.get('departmentId'))));
	const number = form.get('number')?.toString() || '';
	const lastName = form.get('lastName')?.toString() || '';
	const firstName = form.get('firstName')?.toString() || '';
	const middleName = form.get('middleName')?.toString() || '';
	const departmentId = Number(form.get('departmentId'));
	const positionId = Number(form.get('positionId'));
	const date = form.get('date')?.toString() || todayStr();
	const docNumber = form.get('docNumber')?.toString() || null;

	if (!number || !lastName || !firstName) {
		throw new ControllerError(400, 'Заполните ФИО и табельный номер');
	}

	// Табельный номер должен быть свободен
	const existing = await employeeService.getByNumber(number);
	if (existing) {
		throw new ControllerError(409, 'Номер уже занят', {
			error: 'number_taken',
			existing: {
				id: existing.id,
				number: existing.number,
				lastName: existing.lastName,
				firstName: existing.firstName,
				middleName: existing.middleName
			}
		});
	}

	let emp;
	try {
		emp = await employeeService.create({
			number,
			lastName,
			firstName,
			middleName: middleName || null
		});
	} catch (e: any) {
		// Редкая гонка: уникальность номера держит БД (23505 = unique_violation)
		if (e?.code === '23505') {
			const dup = await employeeService.getByNumber(number);
			if (dup) {
				throw new ControllerError(409, 'Номер уже занят', {
					error: 'number_taken',
					existing: {
						id: dup.id,
						number: dup.number,
						lastName: dup.lastName,
						firstName: dup.firstName,
						middleName: dup.middleName
					}
				});
			}
		}
		throw e;
	}

	if (departmentId && positionId) {
		await documentService.create({
			type: 'hiring',
			date,
			docNumber,
			employeeId: emp.id,
			departmentId,
			positionId
		});
	}

	return emp;
}
