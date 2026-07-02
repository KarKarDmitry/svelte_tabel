import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { employee } from '$lib/server/db/apps/tabel/tables/employee';
import { pass as passTable } from '$lib/server/db/apps/tabel/tables/pass';
import { employeePass } from '$lib/server/db/apps/tabel/tables/employee-pass';
import { schedule } from '$lib/server/db/apps/tabel/tables/schedule';
import { schedulePoint } from '$lib/server/db/apps/tabel/tables/schedule-point';
import { employeeSchedule } from '$lib/server/db/apps/tabel/tables/employee-schedule';
import { worktimeTracker } from '$lib/server/db/apps/tabel/tables/worktime-tracker';
import { turnstileEvent } from '$lib/server/db/apps/tabel/tables/turnstile-event';
import { turnstileEventTracker } from '$lib/server/db/apps/tabel/tables/turnstile-event-tracker';
import { appConstant } from '$lib/server/db/apps/tabel/tables/app-constant';
import { and, between, desc, eq, sql } from 'drizzle-orm';
import XLSX from 'xlsx';

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

/* SSE helpers */
const enc = new TextEncoder();
function sse(data: unknown): Uint8Array {
	return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function makeThrottle(intervalMs = 200) {
	let last = 0;
	return {
		send(controller: ReadableStreamDefaultController, data: unknown) {
			const now = Date.now();
			if (now - last >= intervalMs) {
				last = now;
				controller.enqueue(sse(data));
			}
		},
		flush(controller: ReadableStreamDefaultController, data: unknown) {
			last = Date.now();
			controller.enqueue(sse(data));
		}
	};
}

/** ФАЗА 1 + импорт — SSE stream */
export const POST: RequestHandler = async ({ request }) => {
	const fd = await request.formData();
	const file = fd.get('file') as File | null;
	if (!file) return json({ error: 'No file' });

	// Список пропусков, которые пользователь решил пропустить (из предыдущего unresolved)
	let skipPasses: { seria: string; number: string }[] = [];
	try {
		const raw = fd.get('skipPasses');
		if (raw) skipPasses = JSON.parse(raw as string);
	} catch {}

	let cancelled = false;

	const stream = new ReadableStream({
		start(controller) {
			const send = (data: unknown) => {
				if (cancelled) return;
				controller.enqueue(sse(data));
			};
			const throttle = makeThrottle(200);
			const tSend = (data: unknown) => throttle.send(controller, data);
			const tFlush = (data: unknown) => throttle.flush(controller, data);

			// controller.signal доступен в современных рантаймах
			(controller as any).signal?.addEventListener('abort', () => {
				cancelled = true;
			});

			(async () => {
				try {
					const buf = await file.arrayBuffer();
					const wb = XLSX.read(buf, { type: 'array' });
					const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
						header: 1
					});

					// Парсим: [сотрудник, дата, время, подразделение, событие, устройство, серия, номер]
					const passSet = new Map<string, { seria: string; number: string; fullName: string }>();
					let eventCount = 0;
					for (const r of rows) {
						if (r.length < 8) continue;
						const seria = String(r[6] ?? '').trim();
						const num = String(r[7] ?? '').trim();
						if (!seria || !num) continue;
						const nd = normDate(r[1]);
						if (!nd) continue;
						const key = `${seria}|${num}`;
						if (!passSet.has(key)) {
							passSet.set(key, { seria, number: num, fullName: String(r[0] ?? '').trim() });
						}
						eventCount++;
					}

					if (passSet.size === 0) {
						send({ stage: 'error', message: 'Нет данных с пропусками' });
						return;
					}

					send({
						stage: 'parsing',
						current: 0,
						total: passSet.size,
						message: `Найдено ${eventCount} событий, ${passSet.size} пропусков. Поиск сотрудников...`
					});

					// Загружаем существующие пропуска
					const existingPasses = await db
						.select({
							id: passTable.id,
							seria: passTable.seria,
							number: passTable.number,
							employeeId: employeePass.employeeId
						})
						.from(passTable)
						.leftJoin(employeePass, eq(employeePass.passId, passTable.id));

					const passByKey = new Map<string, { passId: number; employeeId: number | null }>();
					for (const p of existingPasses) {
						passByKey.set(`${p.seria ?? ''}|${p.number}`, {
							passId: p.id,
							employeeId: p.employeeId ?? null
						});
					}

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
							tSend({
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
						if (existing && existing.employeeId) {
							known++;
							tSend({
								stage: 'collecting',
								current: known,
								total: passSet.size,
								message: `Уже известен: ${p.fullName}`,
								employee: p.fullName
							});
							continue;
						}

						// Ищем сотрудника по ФИО (для существующих без привязки И для новых)
						const { lastName, firstName } = splitFullName(p.fullName);

						const nameCond = firstName
							? sql`substring(${employee.firstName}, 1, ${firstName.length}) = ${firstName}`
							: sql`1=1`;
						const candidates = await db
							.select({
								id: employee.id,
								number: employee.number,
								lastName: employee.lastName,
								firstName: employee.firstName,
								middleName: employee.middleName
							})
							.from(employee)
							.where(and(eq(employee.lastName, lastName), nameCond))
							.limit(10);

						if (candidates.length === 1) {
							if (existing && !existing.employeeId) {
								// Пропуск есть, но без сотрудника — привязываем существующий
								await db
									.insert(employeePass)
									.values({ employeeId: candidates[0].id, passId: existing.passId })
									.onConflictDoNothing();
								passByKey.set(key, { passId: existing.passId, employeeId: candidates[0].id });
								tSend({
									stage: 'collecting',
									current: known,
									total: passSet.size,
									message: `Привязан: ${p.fullName} → ${candidates[0].lastName} ${candidates[0].firstName}`,
									employee: p.fullName
								});
							} else {
								// Создаём новый пропуск
								const [newPass] = await db
									.insert(passTable)
									.values({ seria: p.seria, number: p.number })
									.returning({ id: passTable.id });
								await db
									.insert(employeePass)
									.values({ employeeId: candidates[0].id, passId: newPass.id });
								passByKey.set(key, { passId: newPass.id, employeeId: candidates[0].id });
								tSend({
									stage: 'collecting',
									current: known,
									total: passSet.size,
									message: `Найден: ${p.fullName} → ${candidates[0].lastName} ${candidates[0].firstName}`,
									employee: p.fullName
								});
							}
							known++;
						} else {
							tSend({
								stage: 'collecting',
								current: known,
								total: passSet.size,
								message: `Не найден: ${p.fullName}`,
								employee: p.fullName
							});
							unresolved.push({
								seria: p.seria,
								number: p.number,
								fullName: p.fullName,
								candidates:
									candidates.length > 1
										? candidates.map((c: any) => ({
												id: c.id,
												number: c.number,
												lastName: c.lastName,
												firstName: c.firstName,
												middleName: c.middleName
											}))
										: [
												{
													id: 0,
													number: '—',
													lastName: 'Не найден',
													firstName: '',
													middleName: null
												}
											]
							});
						}
					}

					if (unresolved.length > 0) {
						tFlush({
							stage: 'unresolved',
							message: `Найдено ${eventCount} событий, ${passSet.size} пропусков. Известно: ${known}, пропущено (времянки): ${skipped}, требуется уточнение: ${unresolved.length}`,
							current: known,
							total: passSet.size,
							unresolved
						});
						return;
					}

					// Все пропуска известны → импортируем события
					tFlush({
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
							console.log('  SKIP event: no employee for pass', seria, num, 'name:', r[0]);
							continue;
						}
						events.push({
							employeeId: ep.employeeId,
							passId: ep.passId,
							date: nd,
							time: normTime(r[2]),
							event: String(r[4]).trim()
						});
					}

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
						empNameMap.set(
							e.id,
							`${e.lastName} ${e.firstName}${e.middleName ? ' ' + e.middleName : ''}`
						);
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
											new Date(minDate),
											new Date(maxDate + 'T23:59:59')
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

					// Отбираем новые события
					const newTurnstileEvents: typeof events = [];
					for (const ev of events) {
						const eventId = eventByName.get(ev.event);
						if (!eventId) continue;
						const key = ev.employeeId + '|' + ev.date + 'T' + ev.time + '|' + eventId;
						if (!existingSet.has(key)) {
							newTurnstileEvents.push(ev);
						}
					}

					// Сохраняем батчами
					if (newTurnstileEvents.length > 0) {
						let savedCount = 0;
						let batch: (typeof turnstileEventTracker.$inferInsert)[] = [];
						for (const ev of newTurnstileEvents) {
							const eventId = eventByName.get(ev.event)!;
							batch.push({
								employeeId: ev.employeeId,
								passId: ev.passId,
								datetime: new Date(ev.date + 'T' + ev.time),
								eventId
							});
							savedCount++;
							if (batch.length >= 500) {
								await db.insert(turnstileEventTracker).values(batch).onConflictDoNothing();
								batch = [];
								tSend({
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
						tFlush({
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
						tSend({
							stage: 'events',
							current: 0,
							total: 0,
							message: 'Нет новых событий турникета',
							employee: ''
						});
					}

					// Группируем по сотруднику, сортируем
					const byEmp = new Map<number, typeof events>();
					for (const e of newTurnstileEvents) {
						if (!byEmp.has(e.employeeId)) byEmp.set(e.employeeId, []);
						byEmp.get(e.employeeId)!.push(e);
					}
					for (const [, evs] of byEmp)
						evs.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

					console.log('  events to process:', newTurnstileEvents.length, 'employees:', byEmp.size);
					for (const [eid, evs] of byEmp) {
						console.log('    emp', eid, empNameMap.get(eid) || '?', 'events:', evs.length);
					}

					tFlush({
						stage: 'processing',
						current: 0,
						total: byEmp.size,
						message: `Обработка событий для ${byEmp.size} сотрудников...`,
						employee: ''
					});

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

						// Ищем последний незакрытый вход из БД (событие могло быть до периода файла)
						const [lastTrackerEvent] = await db
							.select({
								datetime: turnstileEventTracker.datetime,
								eventId: turnstileEventTracker.eventId
							})
							.from(turnstileEventTracker)
							.where(eq(turnstileEventTracker.employeeId, empId))
							.orderBy(desc(turnstileEventTracker.datetime))
							.limit(1);

						if (lastTrackerEvent) {
							const eventType = eventTypeRows.find((et) => et.id === lastTrackerEvent.eventId);
							if (eventType && eventType.name.includes('Вход')) {
								const dt =
									lastTrackerEvent.datetime instanceof Date
										? lastTrackerEvent.datetime
										: new Date(lastTrackerEvent.datetime);
								last = {
									employeeId: empId,
									passId: 0,
									date: dt.toISOString().split('T')[0],
									time: dt.toISOString().split('T')[1].substring(0, 8),
									event: eventType.name
								};
							}
						}

						const ename = empNameMap.get(empId) ?? String(empId);
						for (const ev of evs) {
							console.log(ename, ev.date, ev.time, ev.event, ':');
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
								console.log(
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
									console.log('  arrival_time ->', ep.time);
								} else if (bp && bp.endTime) {
									const bkStart = parseTime(bp.time);
									const bkEnd = parseTime(bp.endTime);
									const breakLeft = bkStart - (bp.leftBound || 0);
									const breakRight = bkEnd + (bp.rightBound || 0);
									if (enter > breakLeft && enter < breakRight) {
										roundedEnter = bkEnd;
										console.log(
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
								console.log(
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
									console.log('  departure_time ->', xp.time);
								} else if (bp && bp.endTime) {
									const bkStart = parseTime(bp.time);
									const bkEnd = parseTime(bp.endTime);
									const breakLeft = bkStart - (bp.leftBound || 0);
									const breakRight = bkEnd + (bp.rightBound || 0);
									if (exit > breakLeft && exit < breakRight) {
										roundedExit = bkStart;
										console.log(
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
								if (shift < 0) shift += 1440;

								if (bp && bp.endTime) {
									const bkStart = parseTime(bp.time);
									const bkEnd = parseTime(bp.endTime);
									if (roundedEnter <= bkStart && roundedExit >= bkEnd) {
										const breakLen = bkEnd - bkStart;
										shift -= breakLen;
										console.log('  with_break ->', ename, ev.date, 'вычет', breakLen, 'мин');
									}
								}

								if (!bp) {
									console.log('  without_break ->', ename, ev.date, 'shift:', formatTime(shift));
								}
							} else {
								shift = exit - enter;
								if (shift < 0) shift += 1440;
								console.log('  without_schedules ->', ename, ev.date, 'shift:', formatTime(shift));
							}

							let night = 0;
							if (isNext || exit > nightStartMin || enter < nightEndMin) {
								if (isNext) {
									night += Math.min(exit, nightEndMin);
									if (enter < nightStartMin) night += nightStartMin - Math.max(enter, 0);
								} else {
									if (enter < nightEndMin && exit > nightEndMin)
										night += Math.min(exit, nightEndMin) - enter;
									if (exit > nightStartMin) night += exit - Math.max(enter, nightStartMin);
								}
							}
							night = Math.round(night);

							const key = `${empId}|${ev.date}`;
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
							console.log(
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

						tSend({
							stage: 'processing',
							current: empIdx,
							total: byEmp.size,
							message: `Обработан сотрудник ${empIdx}/${byEmp.size}`,
							employee: ''
						});
					}

					// Сохраняем батчами по 500 (как в Python-версии)
					const BATCH_SIZE = 500;
					const totalToSave = agg.size;
					tFlush({
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
							reportWorkTime: a.minutes,
							reportNightWorkTime: a.night,
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
										rawWorkTime: sql`EXCLUDED.raw_work_time`,
										rawNightWorkTime: sql`EXCLUDED.raw_night_work_time`,
										shiftWorkTime: sql`EXCLUDED.shift_work_time`,
										shiftNightWorkTime: sql`EXCLUDED.shift_night_work_time`,
										reportWorkTime: sql`EXCLUDED.report_work_time`,
										reportNightWorkTime: sql`EXCLUDED.report_night_work_time`,
										isNightShift: sql`EXCLUDED.is_night_shift`,
										dayMarkCode: sql`EXCLUDED.day_mark_code`
									}
								});
							batch = [];
							tSend({
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
									rawWorkTime: sql`EXCLUDED.raw_work_time`,
									rawNightWorkTime: sql`EXCLUDED.raw_night_work_time`,
									shiftWorkTime: sql`EXCLUDED.shift_work_time`,
									shiftNightWorkTime: sql`EXCLUDED.shift_night_work_time`,
									reportWorkTime: sql`EXCLUDED.report_work_time`,
									reportNightWorkTime: sql`EXCLUDED.report_night_work_time`,
									isNightShift: sql`EXCLUDED.is_night_shift`,
									dayMarkCode: sql`EXCLUDED.day_mark_code`
								}
							});
					}
					tFlush({
						stage: 'saving',
						current: saved,
						total: totalToSave,
						message: `Сохранено ${saved} из ${totalToSave}`,
						employee: ''
					});

					const eventsMsg =
						turnstileSaved > 0
							? `, событий турникета: ${turnstileSaved} новых, пропущено дубликатов: ${turnstileSkipped}`
							: turnstileSkipped > 0
								? `, событий турникета: 0 новых, пропущено дубликатов: ${turnstileSkipped}`
								: '';
					tFlush({
						stage: 'done',
						message: `Импорт завершён: ${pairs} пар, ${saved} дней${eventsMsg}`
					});
				} catch (e: any) {
					if (!cancelled) {
						send({ stage: 'error', message: e.message });
					}
				} finally {
					if (!cancelled) controller.close();
				}
			})();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			'x-accel-buffering': 'no'
		}
	});
};

/** ФАЗА 2: создание пропусков (быстрая операция, без SSE) */
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const { unresolved } = (await request.json()) as {
			unresolved: { seria: string; number: string; employeeId: number }[];
		};

		let created = 0;
		let linked = 0;
		const skipList: { seria: string; number: string }[] = [];
		for (const u of unresolved) {
			if (!u.employeeId || u.employeeId <= 0) {
				// Пользователь выбрал «Пропустить» — не создаём пропуск, запоминаем для пропуска
				skipList.push({ seria: u.seria, number: u.number });
				continue;
			}
			const [newPass] = await db
				.insert(passTable)
				.values({ seria: u.seria, number: u.number })
				.returning({ id: passTable.id });
			created++;
			await db.insert(employeePass).values({ employeeId: u.employeeId, passId: newPass.id });
			linked++;
		}

		return json({
			stage: 'done',
			message: `Создано ${created} пропусков, привязано ${linked} к сотрудникам.${skipList.length ? ` Пропущено: ${skipList.length}.` : ''}`,
			skipList
		});
	} catch (e: any) {
		return json({ stage: 'error', message: e.message });
	}
};
