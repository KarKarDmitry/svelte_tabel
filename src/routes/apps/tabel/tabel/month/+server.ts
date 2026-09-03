import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { tabelMonthData } from '$lib/server/apps/tabel/tabel-core';

/**
 * GET /apps/tabel/tabel/month?year=2026&month=9 — данные табеля за месяц в JSON.
 * Тонкий маршрут над готовым контроллером (только чтение, без прав на запись):
 * слой прав на чтение уже внутри tabelMonthData (не-админ → только подконтрольные отделы).
 * Используется автономным вьювером для Windows XP (client/tabel-viewer).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const data = await tabelMonthData(locals.user, url);
	return json(data);
};
