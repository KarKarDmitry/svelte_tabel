import type { RequestHandler } from './$types';
import { worktimeService } from '$lib/server/db/apps/tabel/services/worktime.service';
import { departmentGroupService } from '$lib/server/db/apps/tabel/services/department-group.service';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import {
	buildT12,
	type ExportOptions
} from '$lib/server/db/apps/tabel/reports/T-12_builder_populate';
import { getControlledDepartmentIds } from '$lib/server/permissions';

const boolParam = (v: string | null, def: boolean) =>
	v === null ? def : v === '1' || v === 'true';

export const GET: RequestHandler = async ({ url, locals }) => {
	const year = Number(url.searchParams.get('year'));
	const month = Number(url.searchParams.get('month'));

	if (!year || !month) {
		return new Response('Invalid params', { status: 400 });
	}

	const calendarIdRaw = url.searchParams.get('calendarId');
	const calendarId = calendarIdRaw ? Number(calendarIdRaw) : undefined;

	// Флаги колонок отчёта
	const options: ExportOptions = {
		showNight: boolParam(url.searchParams.get('showNight'), true),
		showOvertime: boolParam(url.searchParams.get('showOvertime'), false),
		showHoliday: boolParam(url.searchParams.get('showHoliday'), true),
		showAbsence: boolParam(url.searchParams.get('showAbsence'), true),
		autoAbsence: boolParam(url.searchParams.get('autoAbsence'), false)
	};

	// Округление: включается флагом rounding=1, значения — из query roundingParams
	// (заполнены из константы ROUNDING_RULES в диалоге) или из константы как fallback
	const roundingEnabled = boolParam(url.searchParams.get('rounding'), false);
	let roundingConfig: any = null;
	if (roundingEnabled) {
		const rawParams = url.searchParams.get('roundingParams');
		if (rawParams) {
			try {
				const p = JSON.parse(rawParams);
				roundingConfig = {
					roundingPoint: p.roundingPoint ?? null,
					roundingFrom: p.roundingFrom ?? null,
					roundingTo: p.roundingTo ?? null,
					standardLeft: p.standardLeft ?? 0,
					standardRight: p.standardRight ?? 0
				};
			} catch {
				roundingConfig = null;
			}
		}
		if (!roundingConfig) {
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

	const stream = new ReadableStream({
		start(controller) {
			let current = 0;
			let cancelled = false;

			// Клиент закрыл соединение (диалог закрыт) — прекращаем отправку
			(controller as any).signal?.addEventListener('abort', () => {
				cancelled = true;
			});

			const emit = (payload: Record<string, unknown>) => {
				if (cancelled) return;
				try {
					controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
				} catch {
					cancelled = true;
				}
			};

			// Стадия подготовки
			let stageTime = Date.now();
			const emitStage = (stage: string) => {
				console.log(`[export] ${stage}  +${Date.now() - stageTime}ms`);
				stageTime = Date.now();
				emit({ stage, total: 0 });
			};

			(async () => {
				try {
					emitStage('Загрузка данных…');

					const [data, groups] = await Promise.all([
						worktimeService.getMonthGrouped(year, month, {
							calendarId,
							onStage: emitStage
						}),
						departmentGroupService.listWithDepartments()
					]);

					// Не-админ экспортирует только подконтрольные подразделения
					const controlled = await getControlledDepartmentIds(locals.user);
					let departments = data.departments;
					if (controlled !== null) {
						const set = new Set(controlled);
						departments = data.departments.filter((d: any) => set.has(d.id));
					}

					console.log('[export] данные загружены');

					// Считаем общее количество сотрудников
					let totalEmployees = 0;
					for (const d of departments) {
						for (const emp of d.employees) {
							if (emp.days.some((day: any) => !day.blocked)) totalEmployees++;
						}
					}

					const emitter = (division: string, employee: string) => {
						if (!employee) {
							// Информационное событие отдела («Отдел — n сотрудников») — без счётчика
							emit({ current, total: totalEmployees, division, employee: '' });
							return;
						}
						current++;
						emit({ current, total: totalEmployees, division, employee });
					};

					emitStage('Формирование отчёта…');

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

					console.time('export:build');
					const buffer = await buildT12(
						groups,
						departments,
						data.dayMarks,
						year,
						month,
						data.lastDay,
						emitter,
						holidays,
						roundingConfig,
						data.calendarDays,
						data.shiftMarks,
						options
					);
					console.timeEnd('export:build');
					if (cancelled) return;
					const base64 = buffer.toString('base64');
					const msg = `data: ${JSON.stringify({ type: 'done', base64, filename: `Табель_${year}_${String(month).padStart(2, '0')}.xlsx` })}\n\n`;
					try {
						controller.enqueue(new TextEncoder().encode(msg));
					} catch {
						cancelled = true;
					}
					try {
						controller.close();
					} catch {
						// соединение уже закрыто — игнорируем
					}
				} catch (err: any) {
					if (cancelled) return;
					console.error('buildT12 error:', err.message);
					console.error(err.stack);
					const msg = `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`;
					try {
						controller.enqueue(new TextEncoder().encode(msg));
					} catch {
						cancelled = true;
					}
					try {
						controller.close();
					} catch {
						// соединение уже закрыто — игнорируем
					}
				}
			})();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
