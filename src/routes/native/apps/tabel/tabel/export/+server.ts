import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { buildT12, type ExportOptions } from '$lib/server/db/apps/tabel/reports/T-12_builder';
import { getControlledDepartmentIds } from '$lib/server/permissions';

/**
 * Bool-параметр: чекбокс (value=1) + hidden (value=0) с одним name отправляют
 * оба значения; отсутствие параметра — дефолт.
 */
const boolParam = (url: URL, name: string, def: boolean): boolean => {
	const vals = url.searchParams.getAll(name);
	if (vals.length === 0) return def;
	return vals.includes('1') || vals.includes('true');
};

/** Экспорт табеля в XLSX (нативный вариант — скачивание по навигации, без прогресса) */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Не авторизован');
	}

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
			const rules = await appConstantService.getByKey('ROUNDING_RULES');
			try {
				const parsed = rules?.value ? JSON.parse(rules.value) : {};
				roundingConfig = {
					roundingPoint: parsed.roundingPoint ?? null,
					roundingFrom: parsed.roundingFrom ?? null,
					roundingTo: parsed.roundingTo ?? null,
					standardLeft: parsed.standardLeft ?? 0,
					standardRight: parsed.standardRight ?? 0
				};
			} catch {
				roundingConfig = null;
			}
		}
	}

	const [data, groups] = await Promise.all([
		worktimeService.getMonthGrouped(year, month, { calendarId }),
		departmentGroupService.listWithDepartments()
	]);

	// Не-админ экспортирует только подконтрольные подразделения
	const controlled = await getControlledDepartmentIds(locals.user);
	let departments = data.departments;
	if (controlled !== null) {
		const set = new Set(controlled);
		departments = data.departments.filter((d: any) => set.has(d.id));
	}

	// Извлекаем праздничные дни месяца из calendarDays
	const holidays = new Set<number>();
	if (data.calendarDays) {
		for (const [dateStr, dayInfo] of Object.entries(data.calendarDays)) {
			if (dayInfo.dayType === 'holiday') {
				const day = parseInt(dateStr.split('-')[2], 10);
				holidays.add(day);
			}
		}
	}

	const buffer = await buildT12(
		groups,
		departments,
		data.dayMarks,
		year,
		month,
		data.lastDay,
		undefined,
		holidays,
		roundingConfig,
		data.calendarDays,
		data.shiftMarks,
		options,
		(await appConstantService.getByKey('AUTO_ABSENCE_MARK'))?.value
	);

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

function numOrNull(v: string | null): number | null {
	if (v == null || v === '') return null;
	const n = Number(v);
	return isNaN(n) ? null : n;
}

function numOr(v: string | null, def: number): number {
	const n = numOrNull(v);
	return n == null ? def : n;
}
