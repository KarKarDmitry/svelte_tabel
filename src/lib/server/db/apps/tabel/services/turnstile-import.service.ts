/* Импорт событий турникетов из Excel — общий конвейер для modern и native деревьев.
   Роуты только оркеструют: читают запрос и транслируют ImportEvent в SSE / статус.
   Поведение полностью повторяет прежний `src/routes/apps/tabel/import/+server.ts`. */

import { db } from '$lib/server/db';
import { employee } from '$lib/server/db/apps/tabel/tables/employee';
import { pass as passTable } from '$lib/server/db/apps/tabel/tables/pass';
import { employeePass } from '$lib/server/db/apps/tabel/tables/employee-pass';
import { passService } from '$lib/server/db/apps/tabel/services/pass.service';
import { employeeService } from '$lib/server/db/apps/tabel/services/employee.service';
import { documentService } from '$lib/server/db/apps/tabel/services/document.service';
import { schedule } from '$lib/server/db/apps/tabel/tables/schedule';
import { schedulePoint } from '$lib/server/db/apps/tabel/tables/schedule-point';
import { employeeSchedule } from '$lib/server/db/apps/tabel/tables/employee-schedule';
import { worktimeTracker } from '$lib/server/db/apps/tabel/tables/worktime-tracker';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';
import { turnstileEventTracker } from '$lib/server/db/apps/tabel/tables/turnstile-event-tracker';
import { appConstant } from '$lib/server/db/apps/tabel/tables/app-constant';
import { appConstantService } from '$lib/server/db/apps/tabel/services/app-constant.service';
import { and, between, desc, eq, gte, inArray, isNull, lte, lt, sql } from 'drizzle-orm';
import XLSX from 'xlsx';
import { log, flushImportLog } from './import-logger';
import { profReset, profMark, profLog } from './import-profile';

/** Единый тип события импорта (транслируется в SSE modern и в статус native) */
export type ImportEvent = {
	stage: string;
	current?: number;
	total?: number;
	message: string;
	employee?: string;
	unresolved?: unknown[];
};

export type ResolvePick = {
	seria: string;
	number: string;
	passId?: number | null;
	employeeId: number;
	dateFrom?: string;
};

/* helpers */
function excelSerialToDate(serial: number): string {
	const utc = new Date(Date.UTC(1899, 11, 30 + serial));
	return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

function normDate(v: any): string | null {
	if (v == null || v === '') return null;
	if (typeof v === 'number' && v > 40000 && v < 200000) return excelSerialToDate(Math.floor(v));
	if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().split('T')[0];
	const s = String(v).trim();
	if (s.length < 8) return null;
	if (s.includes('.')) {
		const p = s.split('.');
		if (p.length < 3) return null;
		const y = p[2].length === 2 ? '20' + p[2] : p[2];
		if (isNaN(+y) || isNaN(+p[1]) || isNaN(+p[0])) return null;
		return `${y}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
	}
	if (s.includes('-')) {
		const p = s.split('-');
		if (p.length < 3 || isNaN(+p[0])) return null;
		return s;
	}
	return null;
}

function normTime(v: any): string {
	if (typeof v === 'number' && v >= 0 && v < 1) {
		const totalSec = Math.round(v * 86400);
		return `${String(Math.floor(totalSec / 3600)).padStart(2, '0')}:${String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;
	}
	const s = String(v).trim();
	if (s.length === 5) return s + ':00';
	return s;
}

function parseTime(t: string): number {
	const p = t.split(':');
	return parseInt(p[0]) * 60 + parseInt(Math.round(parseFloat(p[1] ?? '0')).toString());
}

function formatTime(minutes: number): string {
	const sign = minutes < 0 ? '-' : '';
	const m = Math.round(Math.abs(minutes));
	return `${sign}${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function splitFullName(full: string): { lastName: string; firstName: string; middleName: string } {
	const parts = full.trim().split(/\s+/);
	return {
		lastName: parts[0] ?? '',
		firstName: parts[1] ?? '',
		middleName: parts.slice(2).join(' ') || ''
	};
}

/**
 * ФАЗА 1 + импорт: парсинг файла, сопоставление пропусков сотрудникам, импорт событий
 * и расчёт рабочего времени. Каждое событие передаётся в `emit` (роут решает, как
 * доставить: SSE-поток / статус в памяти). Возвращает 'done' или 'unresolved'.
 */
export async function runTurnstileImport(opts: {
	file: Buffer;
	skipPasses?: { seria: string; number: string }[];
	emit: (ev: ImportEvent) => void;
}): Promise<'done' | 'unresolved'> {
	const { file, skipPasses = [], emit } = opts;
	profReset();

	try {
		// Смещение времени источника (турникеты) — из app_constant, fallback МСК
		const tzConst = await appConstantService.getByKey('TIMEZONE_OFFSET');
		const tzOffset = tzConst?.value ?? '+03:00';
		const tzMatch = /([+-])(\d{2}):(\d{2})/.exec(tzOffset);
		const tzOffsetMs = tzMatch
			? (tzMatch[1] === '-' ? -1 : 1) * (Number(tzMatch[2]) * 60 + Number(tzMatch[3])) * 60000
			: 3 * 60 * 60000;
		log('  TIMEZONE_OFFSET:', tzOffset);
		const wb = XLSX.read(file, { type: 'buffer' });
		const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
			header: 1
		});

		// Парсим: [сотрудник, дата, время, подразделение, событие, устройство, серия, номер]
		const passSet = new Map<
			string,
			{ seria: string; number: string; fullName: string; firstDate: string }
		>();
		let eventCount = 0;
		for (const r of rows) {
			if (r.length < 8) continue;
			const seria = String(r[6] ?? '').trim();
			const num = String(r[7] ?? '').trim();
			if (!seria || !num) continue;
			const nd = normDate(r[1]);
			if (!nd) continue;
			const key = `${seria}|${num}`;
			const prev = passSet.get(key);
			if (!prev) {
				passSet.set(key, {
					seria,
					number: num,
					fullName: String(r[0] ?? '').trim(),
					firstDate: nd
				});
			} else if (nd < prev.firstDate) {
				prev.firstDate = nd; // первое событие по пропуску — дата начала использования
			}
			eventCount++;
		}

		profMark('parse');
		if (passSet.size === 0) {
			emit({ stage: 'error', message: 'Нет данных с пропусками' });
			return 'done';
		}

		emit({
			stage: 'parsing',
			current: 0,
			total: passSet.size,
			message: `Найдено ${eventCount} событий, ${passSet.size} пропусков. Поиск сотрудников...`
		});

		// Загружаем существующие пропуска с текущим (активным) владельцем
		const existingPasses = await db
			.select({
				id: passTable.id,
				seria: passTable.seria,
				number: passTable.number,
				employeeId: employeePass.employeeId,
				ownerLastName: employee.lastName,
				ownerFirstName: employee.firstName,
				ownerMiddleName: employee.middleName
			})
			.from(passTable)
			.leftJoin(
				employeePass,
				and(eq(employeePass.passId, passTable.id), isNull(employeePass.dateTo))
			)
			.leftJoin(employee, eq(employee.id, employeePass.employeeId));

		const passByKey = new Map<
			string,
			{ passId: number; employeeId: number | null; ownerName: string | null }
		>();
		for (const p of existingPasses) {
			passByKey.set(`${p.seria ?? ''}|${p.number}`, {
				passId: p.id,
				employeeId: p.employeeId ?? null,
				ownerName: p.employeeId
					? [p.ownerLastName, p.ownerFirstName, p.ownerMiddleName].filter(Boolean).join(' ')
					: null
			});
		}

		profMark('existingPasses');

		// Сотрудники для сопоставления по ФИО — грузим один раз, кандидатов ищем в памяти
		// (раньше на каждый пропуск было 2 запроса: кандидаты + статусы — N+1)
		const allEmployees = await employeeService.getAllForMatching();
		const byLastName = new Map<string, typeof allEmployees>();
		for (const e of allEmployees) {
			const key = e.lastName ?? '';
			if (!byLastName.has(key)) byLastName.set(key, []);
			byLastName.get(key)!.push(e);
		}

		// Кандидаты по каждому пропуску (ключ = seria|number) и все их id — одним запросом статусов
		const passCandidates = new Map<string, typeof allEmployees>();
		const allCandIds = new Set<number>();
		for (const [, p] of passSet) {
			const { lastName, firstName, middleName } = splitFullName(p.fullName);
			// Эквивалент SQL: last_name = ? AND first_name LIKE ?% AND (middle_name IS NULL OR middle_name LIKE ?%)
			const cands = (byLastName.get(lastName) ?? [])
				.filter((e) => !firstName || (e.firstName ?? '').startsWith(firstName))
				.filter(
					(e) => !middleName || e.middleName == null || (e.middleName ?? '').startsWith(middleName)
				)
				.slice(0, 10);
			passCandidates.set(`${p.seria}|${p.number}`, cands);
			for (const c of cands) allCandIds.add(c.id);
		}
		const candStatus = await documentService.getLastStatusByEmployeeIds([...allCandIds]);

		// Фильтруем временные/ничьи пропуска
		const skipNames = ['временный пропуск', 'гостевой пропуск', 'разовый пропуск'];

		// Разделяем: известные пропуска, неизвестные
		let known = 0;
		let skipped = 0;
		const unresolved: any[] = [];
		let processed = 0;

		for (const [, p] of passSet) {
			processed++;
			const lowerName = p.fullName.toLowerCase();
			if (
				skipNames.some((s) => lowerName.includes(s)) ||
				skipPasses.some((s) => s.seria === p.seria && s.number === p.number)
			) {
				skipped++;
				emit({
					stage: 'collecting',
					current: known,
					total: passSet.size,
					message: `Пропущено (времянка): ${p.fullName}`,
					employee: p.fullName
				});
				continue;
			}

			const key = `${p.seria}|${p.number}`;
			const existing = passByKey.get(key);

			// Кандидаты найдены в памяти (предзагрузка выше), статусы — из одного батч-запроса
			const candidates = passCandidates.get(key) ?? [];
			const candidatesWithStatus = candidates.map((c) => ({
				id: c.id,
				number: c.number,
				lastName: c.lastName,
				firstName: c.firstName,
				middleName: c.middleName,
				status: candStatus.get(c.id) ?? 'pending'
			}));

			// Пропуск уже принадлежит одному из найденных кандидатов — он «известен»,
			// даже если по ФИО нашлось несколько однофамильцев (в т.ч. уволенных)
			if (existing?.employeeId && candidates.some((c) => c.id === existing.employeeId)) {
				known++;
				emit({
					stage: 'collecting',
					current: known,
					total: passSet.size,
					message: `Уже известен: ${p.fullName}`,
					employee: p.fullName
				});
				continue;
			}

			const pushUnresolved = (cands: any[]) =>
				unresolved.push({
					seria: p.seria,
					number: p.number,
					fullName: p.fullName,
					passId: existing?.passId ?? null,
					firstDate: p.firstDate,
					currentOwner: existing?.employeeId ? existing.ownerName : null,
					candidates: cands
				});

			if (candidates.length === 1) {
				const cand = candidates[0];
				if (existing && !existing.employeeId) {
					// Пропуск есть, но без сотрудника — привязываем существующий
					await db
						.insert(employeePass)
						.values({
							employeeId: cand.id,
							passId: existing.passId,
							dateFrom: p.firstDate
						})
						.onConflictDoNothing();
					passByKey.set(key, {
						passId: existing.passId,
						employeeId: cand.id,
						ownerName: null
					});
					known++;
					emit({
						stage: 'collecting',
						current: known,
						total: passSet.size,
						message: `Привязан: ${p.fullName} → ${cand.lastName} ${cand.firstName}`,
						employee: p.fullName
					});
				} else if (!existing) {
					// Создаём новый пропуск
					const [newPass] = await db
						.insert(passTable)
						.values({ seria: p.seria, number: p.number })
						.returning({ id: passTable.id });
					await db
						.insert(employeePass)
						.values({ employeeId: cand.id, passId: newPass.id, dateFrom: p.firstDate });
					passByKey.set(key, {
						passId: newPass.id,
						employeeId: cand.id,
						ownerName: null
					});
					known++;
					emit({
						stage: 'collecting',
						current: known,
						total: passSet.size,
						message: `Найден: ${p.fullName} → ${cand.lastName} ${cand.firstName}`,
						employee: p.fullName
					});
				} else {
					// Пропуск занят другим сотрудником — предложить переназначить
					emit({
						stage: 'collecting',
						current: known,
						total: passSet.size,
						message: `Занят: ${p.fullName} (${existing.ownerName ?? 'другой сотрудник'})`,
						employee: p.fullName
					});
					pushUnresolved(candidatesWithStatus);
				}
			} else {
				emit({
					stage: 'collecting',
					current: known,
					total: passSet.size,
					message: `Не найден: ${p.fullName}`,
					employee: p.fullName
				});
				pushUnresolved(
					candidates.length > 1
						? candidatesWithStatus
						: [
								{
									id: 0,
									number: '—',
									lastName: 'Не найден',
									firstName: '',
									middleName: null,
									status: null
								}
							]
				);
			}
		}

		profMark('matchPasses');

		if (unresolved.length > 0) {
			// Логируем исключения перед выдачей пользователю
			for (const u of unresolved) {
				log(
					'[unresolved]',
					`pass=${u.seria}${u.number}`,
					`excel_name=${u.fullName}`,
					u.passId ? `pass_id=${u.passId}` : 'pass_id=none',
					u.currentOwner ? `owner=${u.currentOwner}` : 'owner=none',
					u.firstDate ? `first_event=${u.firstDate}` : 'first_event=none',
					`candidates=${u.candidates
						.map(
							(c: any) => `${c.lastName} ${c.firstName ?? ''}(id=${c.id},status=${c.status ?? '?'})`
						)
						.join('; ')}`
				);
			}
			log(
				'[unresolved] итог:',
				`известных=${known}`,
				`времянок=${skipped}`,
				`исключений=${unresolved.length}`
			);

			emit({
				stage: 'unresolved',
				message: `Найдено ${eventCount} событий, ${passSet.size} пропусков. Известно: ${known}, пропущено (времянки): ${skipped}, требуется уточнение: ${unresolved.length}`,
				current: known,
				total: passSet.size,
				unresolved
			});
			return 'unresolved';
		}

		// Все пропуска известны → импортируем события
		emit({
			stage: 'processing',
			current: 0,
			total: 1,
			message: 'Загрузка справочников...',
			employee: ''
		});

		// Собираем все события из файла с employeeId
		const events: {
			employeeId: number;
			passId: number;
			date: string;
			time: string;
			event: string;
		}[] = [];
		for (const r of rows) {
			if (r.length < 8) continue;
			const seria = String(r[6] ?? '').trim();
			const num = String(r[7] ?? '').trim();
			if (!seria || !num) continue;
			const nd = normDate(r[1]);
			if (!nd) continue;
			const key = `${seria}|${num}`;
			const ep = passByKey.get(key);
			if (!ep?.employeeId) {
				log('  SKIP event: no employee for pass', seria, num, 'name:', r[0]);
				continue;
			}
			const t = normTime(r[2]);
			if (events.length < 5) {
				log('  FILE raw:', JSON.stringify(r.slice(0, 8)), '→ date:', nd, 'time:', t);
			}
			events.push({
				employeeId: ep.employeeId,
				passId: ep.passId,
				date: nd,
				time: t,
				event: String(r[4]).trim()
			});
		}
		log('  FILE events parsed:', events.length);

		profMark('collectEvents');

		// Загружаем справочники
		const schedRows = await db.select().from(schedule);
		const schedById = new Map(schedRows.map((s) => [s.id, s]));
		const ptRows = await db.select().from(schedulePoint);
		const ptsBySched = new Map<number, typeof ptRows>();
		for (const p of ptRows) {
			if (!ptsBySched.has(p.scheduleId)) ptsBySched.set(p.scheduleId, []);
			ptsBySched.get(p.scheduleId)!.push(p);
		}

		const esRows = await db.select().from(employeeSchedule);
		const esByEmp = new Map<number, typeof esRows>();
		for (const e of esRows) {
			if (!esByEmp.has(e.employeeId)) esByEmp.set(e.employeeId, []);
			esByEmp.get(e.employeeId)!.push(e);
		}

		// Загружаем имена сотрудников
		const empRows = await db
			.select({
				id: employee.id,
				lastName: employee.lastName,
				firstName: employee.firstName,
				middleName: employee.middleName
			})
			.from(employee);
		const empNameMap = new Map<number, string>();
		for (const e of empRows) {
			empNameMap.set(e.id, `${e.lastName} ${e.firstName}${e.middleName ? ' ' + e.middleName : ''}`);
		}

		// Загружаем константы ночных часов
		const constRows = await db.select().from(appConstant);
		const constMap = new Map(constRows.map((c) => [c.key, c.value]));
		const nightStartStr = constMap.get('NIGHT_SHIFT_START') || '22:00';
		const nightEndStr = constMap.get('NIGHT_SHIFT_END') || '06:00';
		const nightStartMin = parseTime(nightStartStr);
		const nightEndMin = parseTime(nightEndStr);

		// Импорт сырых событий в turnstile_event_tracker
		let turnstileSaved = 0;
		let turnstileSkipped = 0;
		const eventTypeRows = await db.select().from(turnstileEvent);
		const eventByName = new Map(eventTypeRows.map((et) => [et.name, et.id]));

		// Определяем период
		let minDate = '',
			maxDate = '';
		for (const ev of events) {
			if (!minDate || ev.date < minDate) minDate = ev.date;
			if (!maxDate || ev.date > maxDate) maxDate = ev.date;
		}

		profMark('loadDicts');

		// Загружаем существующие события за период
		const existingEvents =
			minDate && maxDate
				? await db
						.select({
							employeeId: turnstileEventTracker.employeeId,
							datetime: turnstileEventTracker.datetime,
							eventId: turnstileEventTracker.eventId
						})
						.from(turnstileEventTracker)
						.where(
							between(
								turnstileEventTracker.datetime,
								new Date(minDate + 'T00:00:00' + tzOffset),
								new Date(maxDate + 'T23:59:59' + tzOffset)
							)
						)
				: [];

		const existingSet = new Set<string>();
		for (const ee of existingEvents) {
			const d = ee.datetime instanceof Date ? ee.datetime.toISOString() : String(ee.datetime);
			// toISOString даёт "2025-01-15T08:30:00.000Z", а из файла "2025-01-15T08:30:00"
			// нормализуем: обрезаем миллисекунды и часовой пояс
			const normalized = d.substring(0, 19);
			existingSet.add(ee.employeeId + '|' + normalized + '|' + ee.eventId);
		}
		log(
			'  DB existing events count:',
			existingEvents.length,
			'(период',
			minDate,
			'…',
			maxDate,
			')'
		);
		for (const ee of existingEvents.slice(0, 5)) {
			const d = ee.datetime instanceof Date ? ee.datetime.toISOString() : String(ee.datetime);
			log('    DB datetime:', {
				raw: ee.datetime,
				iso: d,
				normalized: d.substring(0, 19),
				employeeId: ee.employeeId,
				eventId: ee.eventId
			});
		}
		log('  existingSet keys (sample):', [...existingSet].slice(0, 5));

		// Отбираем новые события
		const newTurnstileEvents: typeof events = [];
		let keySampleLogged = 0;
		for (const ev of events) {
			const eventId = eventByName.get(ev.event);
			if (!eventId) continue;
			// Ключ в UTC — как хранится в БД (datetime = local + tzOffset)
			const dtUtc = new Date(ev.date + 'T' + ev.time + tzOffset).toISOString().substring(0, 19);
			const key = ev.employeeId + '|' + dtUtc + '|' + eventId;
			if (keySampleLogged < 5) {
				keySampleLogged++;
				log('  FILE key:', key, '| in existingSet:', existingSet.has(key));
			}
			if (!existingSet.has(key)) {
				newTurnstileEvents.push(ev);
			}
		}
		log('  NEW events after dedup:', newTurnstileEvents.length, '/', events.length);
		profMark('dedup');

		// Сохраняем батчами
		if (newTurnstileEvents.length > 0) {
			let savedCount = 0;
			let batch: (typeof turnstileEventTracker.$inferInsert)[] = [];
			for (const ev of newTurnstileEvents) {
				const eventId = eventByName.get(ev.event)!;
				batch.push({
					employeeId: ev.employeeId,
					passId: ev.passId,
					datetime: new Date(ev.date + 'T' + ev.time + tzOffset),
					eventId
				});
				savedCount++;
				if (batch.length >= 500) {
					await db.insert(turnstileEventTracker).values(batch).onConflictDoNothing();
					batch = [];
					emit({
						stage: 'events',
						current: savedCount,
						total: newTurnstileEvents.length,
						message: 'Событий турникета: ' + savedCount + '/' + newTurnstileEvents.length,
						employee: ''
					});
				}
			}
			if (batch.length > 0) {
				await db.insert(turnstileEventTracker).values(batch).onConflictDoNothing();
			}
			emit({
				stage: 'events',
				current: savedCount,
				total: newTurnstileEvents.length,
				message:
					'Сохранено событий турникета: ' +
					savedCount +
					', пропущено дубликатов: ' +
					(events.length - newTurnstileEvents.length),
				employee: ''
			});
			turnstileSaved = savedCount;
			turnstileSkipped = events.length - newTurnstileEvents.length;
		} else {
			turnstileSkipped = events.length;
			emit({
				stage: 'events',
				current: 0,
				total: 0,
				message: 'Нет новых событий турникета',
				employee: ''
			});
		}

		profMark('saveEvents');

		// Затронутые сотрудники — те, у кого в этом файле появились новые события.
		// Для них пересчитываем период целиком из событий трекера (включая уже обработанные
		// пары из прошлых прогонов), чтобы часы за день не затирали друг друга при
		// инкрементальном импорте.
		const affectedEmpIds = new Set(newTurnstileEvents.map((e) => e.employeeId));

		// Период пересчёта по локальному времени: с 00:00 дня, предшествующего minDate,
		// до 23:59 maxDate — захватывает ночные смены и висячие входы.
		const recalcFromLocal = new Date(minDate + 'T00:00:00' + tzOffset);
		recalcFromLocal.setHours(recalcFromLocal.getHours() - 24);
		const recalcToLocal = new Date(maxDate + 'T23:59:59' + tzOffset);

		let trackerRows: { employeeId: number; datetime: Date | string; eventId: number }[] = [];
		if (affectedEmpIds.size > 0) {
			trackerRows = await db
				.select({
					employeeId: turnstileEventTracker.employeeId,
					datetime: turnstileEventTracker.datetime,
					eventId: turnstileEventTracker.eventId
				})
				.from(turnstileEventTracker)
				.where(
					and(
						inArray(turnstileEventTracker.employeeId, [...affectedEmpIds]),
						gte(turnstileEventTracker.datetime, new Date(recalcFromLocal.getTime() - tzOffsetMs)),
						lte(turnstileEventTracker.datetime, new Date(recalcToLocal.getTime() - tzOffsetMs))
					)
				);
		}

		const byEmp = new Map<number, typeof events>();
		for (const tr of trackerRows) {
			const dt = tr.datetime instanceof Date ? tr.datetime : new Date(tr.datetime);
			const local = new Date(dt.getTime() + tzOffsetMs);
			const et = eventTypeRows.find((et) => et.id === tr.eventId);
			if (!et) continue;
			const date = local.toISOString().split('T')[0];
			const time = local.toISOString().split('T')[1].substring(0, 8);
			if (!byEmp.has(tr.employeeId)) byEmp.set(tr.employeeId, []);
			byEmp
				.get(tr.employeeId)!
				.push({ employeeId: tr.employeeId, passId: 0, date, time, event: et.name });
		}
		for (const [, evs] of byEmp)
			evs.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

		log('  events to process:', trackerRows.length, 'employees:', byEmp.size);
		for (const [eid, evs] of byEmp) {
			log('    emp', eid, empNameMap.get(eid) || '?', 'events:', evs.length);
		}

		emit({
			stage: 'processing',
			current: 0,
			total: byEmp.size,
			message: `Обработка событий для ${byEmp.size} сотрудников...`,
			employee: ''
		});

		profMark('loadTracker');

		// Восстанавливаем пары Entry/Exit и считаем часы
		const agg = new Map<
			string,
			{ minutes: number; night: number; isNight: boolean; scheduleId: number | null }
		>();
		let pairs = 0;
		let empIdx = 0;
		for (const [empId, evs] of byEmp) {
			empIdx++;
			let last: (typeof evs)[0] | null = null;

			// Ищем последний незакрытый вход из БД (событие могло быть до периода пересчёта).
			// Берём только события строго раньше первого события сотрудника в периоде —
			// иначе в last может попасть «висячий» вход из этого же периода (последний вход без
			// выхода), и он будет неправильно спарен с более ранним выходом.
			const firstEv = evs[0];
			const firstUtc = firstEv ? new Date(firstEv.date + 'T' + firstEv.time + tzOffset) : null;

			if (firstUtc && !isNaN(firstUtc.getTime())) {
				const [lastTrackerEvent] = await db
					.select({
						datetime: turnstileEventTracker.datetime,
						eventId: turnstileEventTracker.eventId
					})
					.from(turnstileEventTracker)
					.where(
						and(
							eq(turnstileEventTracker.employeeId, empId),
							lt(turnstileEventTracker.datetime, firstUtc)
						)
					)
					.orderBy(desc(turnstileEventTracker.datetime))
					.limit(1);

				if (lastTrackerEvent) {
					const eventType = eventTypeRows.find((et) => et.id === lastTrackerEvent.eventId);
					if (eventType && eventType.name.includes('Вход')) {
						const dt =
							lastTrackerEvent.datetime instanceof Date
								? lastTrackerEvent.datetime
								: new Date(lastTrackerEvent.datetime);
						// В БД время в UTC, события файла — в локальном (tzOffset): приводим к локальному
						const local = new Date(dt.getTime() + tzOffsetMs);
						last = {
							employeeId: empId,
							passId: 0,
							date: local.toISOString().split('T')[0],
							time: local.toISOString().split('T')[1].substring(0, 8),
							event: eventType.name
						};
					}
				}
			}

			const ename = empNameMap.get(empId) ?? String(empId);
			for (const ev of evs) {
				log(ename, ev.date, ev.time, ev.event, ':');
				if (ev.event.includes('Вход')) {
					last = ev;
					continue;
				}
				if (!ev.event.includes('Выход') || !last) continue;
				pairs++;
				const enter = parseTime(last.time);
				const exit = parseTime(ev.time);
				const isNext = ev.date !== last.date;
				let raw = exit - enter;
				if (raw < 0) raw += 1440;

				// Определяем лучший график через scoring (как Python determine_best_schedule)
				const empS = esByEmp.get(empId) ?? [];
				// Сортируем: более новые scheduleId идут последними (при равном скоре побеждает последний)
				const sortedEmpS = [...empS].sort((a, b) => a.scheduleId - b.scheduleId);
				let bestPts: typeof ptRows = [];
				let bestScore = 0;
				let bestScheduleId: number | null = null;

				for (const es of sortedEmpS) {
					// Фильтр по датам: если dateTo < даты события — выбывает
					if (es.dateFrom && ev.date < es.dateFrom) continue;
					if (es.dateTo && ev.date > es.dateTo) continue;

					const s = schedById.get(es.scheduleId);
					if (!s) continue;
					const pts = ptsBySched.get(s.id) ?? [];

					// Scoring как в Python
					let score = 0;

					const ep = pts.find((p) => p.type === 'Entry');
					const xp = pts.find((p) => p.type === 'Exit');
					const bp = pts.find((p) => p.type === 'Break');

					if (ep) {
						const planE = parseTime(ep.time);
						const leftB = planE - ep.leftBound;
						const rightB = planE + ep.rightBound;
						if (enter >= leftB && enter <= rightB) {
							const diffSec = Math.abs(enter - planE) * 60;
							score += 10 - Math.min(10, diffSec / 300);
						}
					}

					if (xp) {
						const planX = parseTime(xp.time);
						const leftB = planX - xp.leftBound;
						const rightB = planX + xp.rightBound;
						if (exit >= leftB && exit <= rightB) {
							const diffSec = Math.abs(exit - planX) * 60;
							score += 10 - Math.min(10, diffSec / 300);
						}
					}

					if (bp && bp.endTime) {
						const bkStart = parseTime(bp.time);
						const bkEnd = parseTime(bp.endTime);
						if (enter <= bkStart && exit >= bkEnd) {
							score += 5;
						}
						// Вход/выход в границах перерыва (с допуском)
						const breakLeft = bkStart - (bp.leftBound || 0);
						const breakRight = bkEnd + (bp.rightBound || 0);
						if (enter > breakLeft && enter < breakRight) {
							score += 5; // вход во время перерыва → возвращение с обеда
						}
						if (exit > breakLeft && exit < breakRight) {
							score += 5; // выход во время перерыва → уход на обед
						}
					}

					if (score >= bestScore) {
						bestScore = score;
						bestPts = pts;
						bestScheduleId = es.scheduleId;
					}
				}

				const ep = bestPts.find((p) => p.type === 'Entry');
				const xp = bestPts.find((p) => p.type === 'Exit');
				const bp = bestPts.find((p) => p.type === 'Break');

				let shift: number;

				if (ep && xp) {
					let roundedEnter = enter;
					let roundedExit = exit;

					const planE = parseTime(ep.time);
					const leftB = planE - ep.leftBound;
					const rightB = planE + ep.rightBound;
					log(
						'  Entry:',
						ename,
						last.time,
						'->',
						'левая_гр:',
						formatTime(leftB),
						'правая_гр:',
						formatTime(rightB),
						'->',
						enter >= leftB && enter <= rightB ? 'в границах' : 'вне границ'
					);
					if (enter >= leftB && enter <= rightB) {
						roundedEnter = planE;
						log('  arrival_time ->', ep.time);
					} else if (bp && bp.endTime) {
						const bkStart = parseTime(bp.time);
						const bkEnd = parseTime(bp.endTime);
						const breakLeft = bkStart - (bp.leftBound || 0);
						const breakRight = bkEnd + (bp.rightBound || 0);
						if (enter > breakLeft && enter < breakRight) {
							roundedEnter = bkEnd;
							log(
								'  arrival_time ->',
								bp.endTime,
								'(конец перерыва, границы:',
								formatTime(breakLeft),
								'-',
								formatTime(breakRight),
								')'
							);
						}
					}

					const planX = parseTime(xp.time);
					const leftBX = planX - xp.leftBound;
					const rightBX = planX + xp.rightBound;
					log(
						'  Exit:',
						ename,
						ev.time,
						'->',
						'левая_гр:',
						formatTime(leftBX),
						'правая_гр:',
						formatTime(rightBX),
						'->',
						exit >= leftBX && exit <= rightBX ? 'в границах' : 'вне границ'
					);
					if (exit >= leftBX && exit <= rightBX) {
						roundedExit = planX;
						log('  departure_time ->', xp.time);
					} else if (bp && bp.endTime) {
						const bkStart = parseTime(bp.time);
						const bkEnd = parseTime(bp.endTime);
						const breakLeft = bkStart - (bp.leftBound || 0);
						const breakRight = bkEnd + (bp.rightBound || 0);
						if (exit > breakLeft && exit < breakRight) {
							roundedExit = bkStart;
							log(
								'  departure_time ->',
								bp.time,
								'(начало перерыва, границы:',
								formatTime(breakLeft),
								'-',
								formatTime(breakRight),
								')'
							);
						}
					}

					shift = roundedExit - roundedEnter;
					// Отрицательный результат после «снаппинга» к плановым точкам графика (напр., короткая
					// пара: вход округлился вперёд к плану, а выход остался реальным) — это не ночная
					// смена, а ошибка округления. Ночной перенос уже учтён в raw (raw += 1440 выше).
					if (shift < 0) shift = raw;

					if (bp && bp.endTime) {
						const bkStart = parseTime(bp.time);
						const bkEnd = parseTime(bp.endTime);
						if (roundedEnter <= bkStart && roundedExit >= bkEnd) {
							const breakLen = bkEnd - bkStart;
							shift -= breakLen;
							log('  with_break ->', ename, ev.date, 'вычет', breakLen, 'мин');
						}
					}

					if (!bp) {
						log('  without_break ->', ename, ev.date, 'shift:', formatTime(shift));
					}
				} else {
					shift = exit - enter;
					if (shift < 0) shift += 1440;
					log('  without_schedules ->', ename, ev.date, 'shift:', formatTime(shift));
				}

				let night = 0;
				if (isNext || exit > nightStartMin || enter < nightEndMin) {
					if (isNext) {
						// Ночь: [00:00 → 06:00] + [22:00 → 24:00]. Время до 22:00 ночью не является.
						night += Math.min(exit, nightEndMin);
						night += Math.max(0, 1440 - Math.max(enter, nightStartMin));
					} else {
						if (enter < nightEndMin && exit > nightEndMin)
							night += Math.min(exit, nightEndMin) - enter;
						if (exit > nightStartMin) night += exit - Math.max(enter, nightStartMin);
					}
				}
				night = Math.round(night);

				const key = `${empId}|${last.date}`;
				if (!agg.has(key))
					agg.set(key, {
						minutes: 0,
						night: 0,
						isNight: false,
						scheduleId: null
					});
				const a = agg.get(key)!;
				a.minutes += Math.max(0, shift);
				a.night += night;
				a.scheduleId = bestScheduleId;
				if (night > shift / 2) a.isNight = true;
				last = null;
				log(
					'  result ->',
					ename,
					ev.date,
					'shift:',
					formatTime(shift),
					'ночных:',
					night,
					'мин',
					night > shift / 2 ? '(ночная)' : '(дневная)'
				);
			}

			emit({
				stage: 'processing',
				current: empIdx,
				total: byEmp.size,
				message: `Обработан сотрудник ${empIdx}/${byEmp.size}`,
				employee: ''
			});
		}

		profMark('pairing');

		// Сохраняем батчами по 500 (как в Python-версии)
		const BATCH_SIZE = 500;
		const totalToSave = agg.size;
		emit({
			stage: 'saving',
			current: 0,
			total: totalToSave,
			message: `Сохранение ${totalToSave} записей в БД...`,
			employee: ''
		});

		let saved = 0;
		let batch: (typeof worktimeTracker.$inferInsert)[] = [];
		for (const [key, a] of agg) {
			const [eId, d] = key.split('|');
			batch.push({
				employeeId: +eId,
				date: d,
				isNightShift: a.isNight,
				dayMarkCode: a.isNight ? 'Н' : 'Я',
				rawWorkTime: a.minutes,
				rawNightWorkTime: a.night,
				shiftWorkTime: a.minutes,
				shiftNightWorkTime: a.night,
				scheduleId: a.scheduleId
			});
			saved++;

			if (batch.length >= BATCH_SIZE) {
				await db
					.insert(worktimeTracker)
					.values(batch)
					.onConflictDoUpdate({
						target: [worktimeTracker.employeeId, worktimeTracker.date],
						set: {
							// report_* не трогаем: отчётные часы заполняет только табельщик вручную
							rawWorkTime: sql`EXCLUDED.raw_work_time`,
							rawNightWorkTime: sql`EXCLUDED.raw_night_work_time`,
							shiftWorkTime: sql`EXCLUDED.shift_work_time`,
							shiftNightWorkTime: sql`EXCLUDED.shift_night_work_time`,
							isNightShift: sql`EXCLUDED.is_night_shift`,
							dayMarkCode: sql`EXCLUDED.day_mark_code`
						}
					});
				batch = [];
				emit({
					stage: 'saving',
					current: saved,
					total: totalToSave,
					message: `Сохранено ${saved} из ${totalToSave}`,
					employee: ''
				});
			}
		}
		if (batch.length > 0) {
			await db
				.insert(worktimeTracker)
				.values(batch)
				.onConflictDoUpdate({
					target: [worktimeTracker.employeeId, worktimeTracker.date],
					set: {
						// report_* не трогаем: отчётные часы заполняет только табельщик вручную
						rawWorkTime: sql`EXCLUDED.raw_work_time`,
						rawNightWorkTime: sql`EXCLUDED.raw_night_work_time`,
						shiftWorkTime: sql`EXCLUDED.shift_work_time`,
						shiftNightWorkTime: sql`EXCLUDED.shift_night_work_time`,
						isNightShift: sql`EXCLUDED.is_night_shift`,
						dayMarkCode: sql`EXCLUDED.day_mark_code`
					}
				});
		}
		emit({
			stage: 'saving',
			current: saved,
			total: totalToSave,
			message: `Сохранено ${saved} из ${totalToSave}`,
			employee: ''
		});

		profMark('saveWorktime');

		const eventsMsg =
			turnstileSaved > 0
				? `, событий турникета: ${turnstileSaved} новых, пропущено дубликатов: ${turnstileSkipped}`
				: turnstileSkipped > 0
					? `, событий турникета: 0 новых, пропущено дубликатов: ${turnstileSkipped}`
					: '';
		emit({
			stage: 'done',
			message: `Импорт завершён: ${pairs} пар, ${saved} дней${eventsMsg}`
		});
		return 'done';
	} catch (e: any) {
		emit({ stage: 'error', message: e.message });
		return 'error' as never;
	} finally {
		// Всегда выводим профиль и гарантируем запись лога в файл
		profLog();
		flushImportLog();
	}
}

/**
 * ФАЗА 2: создать/переназначить пропуска по выбору пользователя.
 * Возвращает сводку и список пропусков для пропуска при повторном импорте.
 */
export async function resolvePassPicks(unresolved: ResolvePick[]): Promise<{
	created: number;
	linked: number;
	reassigned: number;
	skipList: { seria: string; number: string }[];
	message: string;
}> {
	let created = 0;
	let linked = 0;
	let reassigned = 0;
	const skipList: { seria: string; number: string }[] = [];
	for (const u of unresolved) {
		if (!u.employeeId || u.employeeId <= 0) {
			// Пользователь выбрал «Пропустить» — не создаём пропуск, запоминаем для пропуска
			skipList.push({ seria: u.seria, number: u.number });
			log('[PUT] пропущен:', `${u.seria}${u.number}`);
			continue;
		}
		// Дата начала использования — первое событие по пропуску из файла
		const dateFrom = u.dateFrom || new Date().toISOString().split('T')[0];

		if (u.passId && u.passId > 0) {
			// Пропуск уже существует (занят другим) — переназначаем новому сотруднику:
			// закрываем текущему владельцу (dateTo = день до первого события) и выдаём новому
			const active = await passService.getActiveAssignment(u.passId);
			if (active) {
				const prevDay = new Date(new Date(`${dateFrom}T00:00:00`).getTime() - 86400000)
					.toISOString()
					.split('T')[0];
				await passService.closeEmployeePass(active.id, prevDay);
				log('[PUT] закрыта старая привязка:', `assignment_id=${active.id}`, `date_to=${prevDay}`);
			}
			await passService.assignToEmployee({
				employeeId: u.employeeId,
				passId: u.passId,
				dateFrom
			});
			reassigned++;
			log(
				'[PUT] переназначен:',
				`${u.seria}${u.number}`,
				`pass_id=${u.passId}`,
				`employee_id=${u.employeeId}`,
				`date_from=${dateFrom}`
			);
		} else {
			const [newPass] = await db
				.insert(passTable)
				.values({ seria: u.seria, number: u.number })
				.returning({ id: passTable.id });
			created++;
			await passService.assignToEmployee({
				employeeId: u.employeeId,
				passId: newPass.id,
				dateFrom
			});
			linked++;
			log(
				'[PUT] создан:',
				`${u.seria}${u.number}`,
				`new_pass_id=${newPass.id}`,
				`employee_id=${u.employeeId}`,
				`date_from=${dateFrom}`
			);
		}
	}
	log(
		'[PUT] итог:',
		`создано=${created}`,
		`привязано=${linked}`,
		`переназначено=${reassigned}`,
		`пропущено=${skipList.length}`
	);
	flushImportLog();

	return {
		created,
		linked,
		reassigned,
		skipList,
		message: `Создано ${created} пропусков, привязано ${linked}, переназначено ${reassigned}.${skipList.length ? ` Пропущено: ${skipList.length}.` : ''}`
	};
}
