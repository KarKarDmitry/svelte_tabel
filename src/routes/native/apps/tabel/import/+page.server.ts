import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/permissions';
import { createProcess } from '$lib/server/apps/tabel/import-process';
import { runImportProcess } from '$lib/server/apps/tabel/native-import';

export const load: PageServerLoad = async (event) => {
	if (!isAdmin(event.locals.user)) {
		throw redirect(303, '/native/apps/tabel/tabel');
	}
	return {};
};

export const actions: Actions = {
	/** Старт импорта: сохраняем файл в процесс, запускаем фоном, редиректим на /import/[id] */
	upload: async (event) => {
		if (!isAdmin(event.locals.user)) {
			return fail(403, { message: 'Требуются права администратора' });
		}

		const fd = await event.request.formData();
		const file = fd.get('file') as File | null;
		if (!file) {
			return fail(400, { message: 'Файл не выбран' });
		}

		const buf = Buffer.from(await file.arrayBuffer());
		const id = createProcess(buf, file.name);

		// Fire-and-forget: импорт идёт в фоне, страница статуса опрашивает сервер
		void runImportProcess(id);

		throw redirect(303, `/native/apps/tabel/import/${id}`);
	}
};
