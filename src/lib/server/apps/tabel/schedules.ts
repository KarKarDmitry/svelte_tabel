/**
 * Контроллеры графиков работы: список, карточка графика.
 * Формат weekDays нормализуется контроллером (массив номеров дней);
 * транспорт отдаёт его как строку "1,2,3" (modern) или чекбоксы (native).
 */

import { error } from '@sveltejs/kit';
import { scheduleService } from '$lib/server/db/apps/tabel/services/schedule.service';
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

/** "08:00" → минуты; пусто → 480 */
function hoursToMinutes(hoursStr: string): number {
	const [h, m] = hoursStr.split(':').map(Number);
	return h * 60 + (m || 0);
}

export async function schedulesListData() {
	const schedules = await scheduleService.list();
	return { schedules };
}

export async function scheduleCreate(
	user: CtrlUser,
	input: { name: string; hoursStr: string; weekDays: number[] }
) {
	assertEdit(user);
	const s = await scheduleService.create({
		name: input.name,
		standardWorkTime: hoursToMinutes(input.hoursStr),
		weekDays: input.weekDays.length ? JSON.stringify(input.weekDays) : null
	});
	return s;
}

export async function scheduleCardData(id: number) {
	const schedule = await scheduleService.getWithPoints(id);
	if (!schedule) throw error(404, 'График не найден');
	return { schedule };
}

export async function scheduleUpdate(
	user: CtrlUser,
	id: number,
	input: { name?: string; hoursStr: string; weekDays: number[] }
) {
	assertEdit(user);
	await scheduleService.update(id, {
		name: input.name,
		standardWorkTime: hoursToMinutes(input.hoursStr),
		weekDays: input.weekDays.length ? JSON.stringify(input.weekDays) : null
	});
}
