/**
 * Контроллеры производственного календаря: список календарей и шаблонов.
 * Современные-only эндпоинты шаблонов (points/special_days) не дублируются
 * и остаются в дереве /apps.
 */

import { calendarService } from '$lib/server/db/apps/tabel/services/calendar.service';
import { denyIfNoEdit } from '$lib/server/permissions';
import { ControllerError } from '$lib/server/context/controller';
import type { CtrlUser } from '$lib/server/context/controller';

function assertEdit(user: CtrlUser): void {
	const denied = denyIfNoEdit(user);
	if (denied) {
		throw new ControllerError(
			denied.status,
			(denied.data?.message as string) ?? 'Недостаточно прав для редактирования'
		);
	}
}

/** Список календарей + шаблонов */
export async function calendarListData() {
	const [calendars, templates] = await Promise.all([
		calendarService.listCalendars(),
		calendarService.listTemplates()
	]);
	return { calendars, templates };
}

/** Создать календарь из шаблона и сгенерировать год; null — шаблон/год не дали календарь */
export async function calendarGenerate(
	user: CtrlUser,
	form: FormData
): Promise<{ id: number } | null> {
	assertEdit(user);
	const name = form.get('name')?.toString() || '';
	const templateId = Number(form.get('templateId'));
	const year = Number(form.get('year'));

	const cal = await calendarService.createCalendar({ templateId, year, name });
	if (!cal) return null;

	await calendarService.generateYear(cal.id);
	return cal;
}

export async function calendarDelete(user: CtrlUser, id: number) {
	assertEdit(user);
	await calendarService.removeCalendar(id);
}

export async function calendarSetDefault(user: CtrlUser, id: number) {
	assertEdit(user);
	await calendarService.setDefaultCalendar(id);
}

/** Создать шаблон (рабочие дни пн–пт, 480 мин) */
export async function templateCreate(user: CtrlUser, name: string) {
	assertEdit(user);
	return calendarService.createTemplate({
		name,
		year: 0,
		defaultWorkDays: JSON.stringify([1, 2, 3, 4, 5]),
		defaultWorkTime: 480
	});
}

/** Список шаблонов календарей */
export async function templateListData() {
	const templates = await calendarService.listTemplates();
	return { templates };
}

export async function templateDelete(user: CtrlUser, id: number) {
	assertEdit(user);
	await calendarService.removeTemplate(id);
}
