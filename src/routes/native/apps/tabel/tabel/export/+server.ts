import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { requireEdit } from '$lib/server/permissions';
import { buildT12Workbook, roundingRulesFromConstants } from '$lib/server/apps/tabel/export';
import type { ExportOptions } from '$lib/server/db/apps/tabel/reports/T-12_builder';

/**
 * Bool-параметр: чекбокс (value=1) + hidden (value=0) с одним name отправляют
 * оба значения; отсутствие параметра — дефолт.
 */
const boolParam = (url: URL, name: string, def: boolean): boolean => {
	const vals = url.searchParams.getAll(name);
	if (vals.length === 0) return def;
	return vals.includes('1') || vals.includes('true');
};

const numOrNull = (v: string | null): number | null => {
	if (v == null || v === '') return null;
	const n = Number(v);
	return isNaN(n) ? null : n;
};

const numOr = (v: string | null, def: number): number => {
	const n = numOrNull(v);
	return n == null ? def : n;
};

/** Экспорт табеля в XLSX (нативный вариант — скачивание по навигации, без прогресса) */
export const GET: RequestHandler = async ({ url, locals }) => {
	requireEdit(locals.user);

	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month'));
	if (!year || !month || month < 1 || month > 12) {
		throw error(400, 'year и month обязательны');
	}

	const calendarIdRaw = url.searchParams.get('calendarId');
	const calendarId = calendarIdRaw ? Number(calendarIdRaw) : undefined;

	// Флаги колонок отчёта — как в современной версии
	const options: ExportOptions = {
		showNight: boolParam(url, 'showNight', true),
		showOvertime: boolParam(url, 'showOvertime', false),
		showHoliday: boolParam(url, 'showHoliday', true),
		showAbsence: boolParam(url, 'showAbsence', true),
		autoAbsence: boolParam(url, 'autoAbsence', false)
	};

	// Округление: rounding=1 + значения из query (roundingPoint, ...), иначе ROUNDING_RULES
	const roundingEnabled = boolParam(url, 'rounding', false);
	let roundingConfig: any = null;
	if (roundingEnabled) {
		const fromQuery =
			url.searchParams.get('roundingPoint') != null ||
			url.searchParams.get('roundingFrom') != null ||
			url.searchParams.get('roundingTo') != null;
		if (fromQuery) {
			roundingConfig = {
				roundingPoint: numOrNull(url.searchParams.get('roundingPoint')),
				roundingFrom: numOrNull(url.searchParams.get('roundingFrom')),
				roundingTo: numOrNull(url.searchParams.get('roundingTo')),
				standardLeft: numOr(url.searchParams.get('standardLeft'), 0),
				standardRight: numOr(url.searchParams.get('standardRight'), 0)
			};
		} else {
			roundingConfig = await roundingRulesFromConstants();
		}
	}

	const buffer = await buildT12Workbook(locals.user, {
		year,
		month,
		calendarId,
		options,
		roundingConfig,
		autoAbsenceMark: (await appConstantService.getByKey('AUTO_ABSENCE_MARK'))?.value
	});

	const fileName = `Табель_${year}_${String(month).padStart(2, '0')}.xlsx`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			// filename*= (RFC 5987) — кириллица в имени файла работает в Chrome 49,
			// обычный filename — фолбэк для старых браузеров
			'Content-Disposition': `attachment; filename="tabel_${year}_${month}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`
		}
	});
};
