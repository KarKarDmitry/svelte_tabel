import type { Actions } from './$types';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
import { redirect } from '@sveltejs/kit';
import {
	denyIfCannotEditEmployee,
	denyIfNoEdit,
	getControlledDepartmentIds
} from '$lib/server/permissions';

export const actions: Actions = {
	rehire: async (event) => {
		const id = Number(event.params.id);
		const form = await event.request.formData();
		const newDeptId = Number(form.get('departmentId'));
		let denied = await denyIfCannotEditEmployee(event.locals.user, id, newDeptId);
		// Уволенного можно принять повторно, если он работал в подконтрольном отделе
		if (denied && event.locals.user?.role !== 'admin') {
			const docs = await documentService.getByEmployee(id);
			// getByEmployee сортирует по дате DESC — первый не-dismissal и есть последний
			const lastNonDismissal = docs.find((d) => d.type !== 'dismissal');
			if (lastNonDismissal) {
				const controlled = await getControlledDepartmentIds(event.locals.user);
				if (controlled?.includes(lastNonDismissal.departmentId)) denied = null;
			}
		}
		if (denied) return denied;
		await documentService.create({
			type: 'hiring',
			date: form.get('date')?.toString() || '',
			docNumber: form.get('docNumber')?.toString() || null,
			employeeId: id,
			departmentId: newDeptId,
			positionId: Number(form.get('positionId'))
		});
		redirect(302, event.url.pathname);
	},
	transfer: async (event) => {
		const id = Number(event.params.id);
		const form = await event.request.formData();
		// Перевод разрешён только в подконтрольные подразделения
		const denied = await denyIfCannotEditEmployee(
			event.locals.user,
			id,
			Number(form.get('departmentId'))
		);
		if (denied) return denied;
		await documentService.create({
			type: 'transfer',
			date: form.get('date')?.toString() || '',
			docNumber: form.get('docNumber')?.toString() || null,
			employeeId: id,
			departmentId: Number(form.get('departmentId')),
			positionId: Number(form.get('positionId'))
		});
		redirect(302, event.url.pathname);
	},
	dismiss: async (event) => {
		const id = Number(event.params.id);
		const denied = await denyIfCannotEditEmployee(event.locals.user, id);
		if (denied) return denied;
		const form = await event.request.formData();
		const date = form.get('date')?.toString() || new Date().toISOString().split('T')[0];
		const lastDoc = await documentService.getActiveAtDate(
			id,
			new Date().toISOString().split('T')[0]
		);
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
		redirect(302, `/apps/tabel/employees/${id}/main`);
	},

	cancelDoc: async (event) => {
		const id = Number((await event.request.formData()).get('id'));
		const doc = await documentService.getById(id);
		// Проверка по отделу из документа (для увольнения — отдел до увольнения),
		// чтобы табельщик мог отменить ошибочное увольнение
		const denied = doc
			? await denyIfCannotEditEmployee(event.locals.user, doc.employeeId, doc.departmentId)
			: denyIfNoEdit(event.locals.user);
		if (denied) return denied;
		await documentService.remove(id);
		return { success: true };
	}
};
