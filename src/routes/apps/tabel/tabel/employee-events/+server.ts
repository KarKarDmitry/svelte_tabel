import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { employeeEventsRead, employeeEventsSave } from '$lib/server/apps/tabel/tabel-core';
import type { EmployeeEventDayInput } from '$lib/server/apps/tabel/tabel-core';
import { ControllerError } from '$lib/server/context/controller';

/** GET: загрузить данные для модального окна */
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const data = await employeeEventsRead(
			locals.user,
			Number(url.searchParams.get('employeeId')),
			Number(url.searchParams.get('year')),
			Number(url.searchParams.get('month'))
		);
		return json(data);
	} catch (e) {
		if (e instanceof ControllerError) throw error(e.status, e.message);
		throw e;
	}
};

/** POST: сохранить изменения из модального окна */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { employeeId, days } = (await request.json()) as {
		employeeId: number;
		days: EmployeeEventDayInput[];
	};
	try {
		const { updated } = await employeeEventsSave(locals.user, employeeId, days);
		return json({ updated });
	} catch (e) {
		if (e instanceof ControllerError) throw error(e.status, e.message);
		throw e;
	}
};
