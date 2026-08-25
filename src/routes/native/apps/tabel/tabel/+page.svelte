<script lang="ts">
	import { page } from '$app/stores';
	import { cellStyle, esc } from '$lib/apps/tabel/utils';
	import {
		Collapsible,
		SubCollapsible,
		Card,
		Select,
		Input,
		Checkbox,
		Button,
		Flex
	} from '$lib/components/native/ui';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import BulkAssignNative from './BulkAssignNative.svelte';
	import EmployeeEventsNative from './EmployeeEventsNative.svelte';

	const data = $derived($page.data);

	const calendarOptions = $derived(
		(data.calendars ?? []).map((c: any) => ({ value: c.id, label: `${c.name} (${c.year})` }))
	);
	const roundingRules = $derived(data.roundingRules ?? {});

	const months = [
		'Январь',
		'Февраль',
		'Март',
		'Апрель',
		'Май',
		'Июнь',
		'Июль',
		'Август',
		'Сентябрь',
		'Октябрь',
		'Ноябрь',
		'Декабрь'
	];

	function pad(n: number): string {
		return String(n).padStart(2, '0');
	}

	function dateStr(day: number): string {
		return `${data.year}-${pad(data.month)}-${pad(day)}`;
	}

	function getDayMark(value: string): string {
		if (!value) return '';
		const mark = (data.dayMarks ?? []).find((m: any) => m.shortName === value || m.code === value);
		return mark?.shortName ?? value;
	}

	function fmt(minutes: number | null): string {
		if (minutes == null) return '';
		return (minutes / 60).toFixed(1);
	}

	/** Расцветка ячейки — общая функция (серверная и SSR) */
	const cellCtx = $derived({
		shiftMarks: data.shiftMarks ?? [],
		calendarDays: data.calendarDays ?? {},
		schedulesById: data.schedulesById ?? {},
		cellColorRules: data.cellColorRules ?? {},
		markColorRules: data.markColorRules ?? {}
	});

	/** Строки «часы» и «метки» для сотрудника (аналог DepartmentCard.buildRows) */
	function empRows(emp: any) {
		const showActual = data.actual;
		const days: any[] = emp.days ?? [];
		let totalReport = 0;
		let totalNight = 0;

		const cells = days.map((day: any) => {
			const stdMin =
				data.calendarDays?.[day.date]?.workTime ??
				(day.scheduleId && data.schedulesById?.[day.scheduleId]
					? data.schedulesById[day.scheduleId].standardWorkTime
					: null) ??
				emp.schedule?.standardWorkTime;
			const workTime = showActual ? day.rawWorkTime : (day.reportWorkTime ?? day.shiftWorkTime);
			const nightTime = showActual
				? day.rawNightWorkTime
				: (day.reportNightWorkTime ?? day.shiftNightWorkTime);
			totalReport += workTime ?? 0;
			totalNight += nightTime ?? 0;
			// Звёздочка — день с отчётными значениями (проставлен табельщиком)
			const hasReport = day.reportWorkTime != null || day.reportNightWorkTime != null;
			// Отчётные часы приоритетны; пока табельщик их не проставил — берём сменные из импорта
			const workMinutes = day.reportWorkTime ?? day.shiftWorkTime;
			const hasShortage = workMinutes != null && stdMin != null && workMinutes < stdMin;
			return {
				date: day.date,
				dayNum: Number(day.date.split('-')[2]),
				// В режиме «Фактическое время» показываем метку факта импорта
				mark: getDayMark(showActual ? day.factMarkCode || '' : day.dayMarkCode),
				blocked: day.blocked ?? false,
				missing: hasShortage ? stdMin - workMinutes : 0,
				hours: fmt(workTime) + (hasReport && !showActual ? '*' : ''),
				minutes: workTime ?? 0,
				minutesNight: nightTime ?? 0,
				style: cellStyle(day, emp.schedule, cellCtx)
			};
		});

		const byDay = new Map(cells.map((c: any) => [c.dayNum, c]));

		return {
			id: emp.id,
			number: emp.number,
			fio: `${emp.lastName} ${emp.firstName}`,
			totalReport: (totalReport / 60).toFixed(1),
			totalNight: (totalNight / 60).toFixed(1),
			totalReportMinutes: totalReport,
			totalNightMinutes: totalNight,
			cell: (dayNum: number) => byDay.get(dayNum)
		};
	}

	const nav = $derived.by(() => {
		const y = data.year;
		const m = data.month;
		const prev = m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
		const next = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
		return { prev, next };
	});

	function qs(p: { year: number; month: number }): string {
		const a = data.actual ? '&actual=1' : '';
		return `?year=${p.year}&month=${p.month}${a}`;
	}

	/** Кнопка «Быстрое назначение» для подразделения (инлайн onclick для XP) */
	function bulkBtn(dept: any): string {
		return `<button type="button" class="native-btn native-btn-small" onclick="xpBulkOpen('bulk_${dept.id}')">Быстрое назначение</button>`;
	}
</script>

<svelte:head>
	<script>
		// --- Сохранение отметок с debounce (как в основном табеле) ---
		var nativeTimers = {};
		var NATIVE_MARKS_URL = '/native/apps/tabel/tabel/marks';

		// Режим «Фактическое время» читаем из data-атрибута на теле страницы:
		// Svelte не вычисляет {…} внутри <script>, литерал ломает парсинг всего блока.
		function nativeActual() {
			var el = document.getElementById('tabel_state');
			return el ? Number(el.getAttribute('data-actual')) || 0 : 0;
		}

		function nativeSchedule(empId, date, value) {
			var key = empId + '_' + date;
			if (nativeTimers[key]) clearTimeout(nativeTimers[key]);
			nativeTimers[key] = setTimeout(function () {
				nativeTimers[key] = null;
				nativeSend(empId, date, value);
			}, 10);
		}

		function nativeSend(empId, date, value) {
			var body =
				'employeeId=' +
				encodeURIComponent(empId) +
				'&date=' +
				encodeURIComponent(date) +
				'&shortName=' +
				encodeURIComponent(value);
			var xhr = new XMLHttpRequest();
			xhr.open('POST', NATIVE_MARKS_URL, true);
			xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
			xhr.onreadystatechange = function () {
				if (xhr.readyState !== 4) return;
				if (xhr.status !== 200) {
					alert('Не удалось сохранить отметку (' + xhr.status + ')');
					return;
				}
				var resp = null;
				try {
					resp = JSON.parse(xhr.responseText);
				} catch (e) {}
				if (!resp || !resp.ok || !resp.updated) return;
				nativeApply(resp.updated);
			};
			xhr.send(body);
		}

		function nativeApply(updated) {
			var hoursCell = document.getElementById('hours_' + updated.employeeId + '_' + updated.date);
			var markCell = document.getElementById(
				'cell_mark_' + updated.employeeId + '_' + updated.date
			);
			var total = document.getElementById('total_' + updated.employeeId);
			var totalNight = document.getElementById('total_night_' + updated.employeeId);
			if (!hoursCell) return;

			var newMin = updated.reportWorkTime == null ? 0 : updated.reportWorkTime;
			var newNight = updated.reportNightWorkTime == null ? 0 : updated.reportNightWorkTime;
			var oldMin = Number(hoursCell.getAttribute('data-minutes') || 0);
			var oldNight = Number(hoursCell.getAttribute('data-night') || 0);

			hoursCell.setAttribute('data-minutes', newMin);
			hoursCell.setAttribute('data-night', newNight);
			// Звёздочка — отчётные значения проставлены (в режиме «фактическое» не показываем)
			var star = nativeActual()
				? ''
				: updated.reportWorkTime != null || updated.reportNightWorkTime != null
					? '*'
					: '';
			hoursCell.innerText = (newMin ? (newMin / 60).toFixed(1) : '') + star;

			// Расцветка приходит от сервера (полем style)
			var style = updated.style || '';
			if (hoursCell) hoursCell.setAttribute('style', style);
			if (markCell) markCell.setAttribute('style', style);

			if (total) {
				var dMin = newMin - oldMin;
				total.setAttribute('data-minutes', Number(total.getAttribute('data-minutes') || 0) + dMin);
				total.innerText = (Number(total.getAttribute('data-minutes')) / 60).toFixed(1);
			}
			if (totalNight) {
				var dNight = newNight - oldNight;
				totalNight.setAttribute(
					'data-minutes',
					Number(totalNight.getAttribute('data-minutes') || 0) + dNight
				);
				totalNight.innerText = (Number(totalNight.getAttribute('data-minutes')) / 60).toFixed(1);
			}
		}

		// Применение результата массового назначения без перезагрузки страницы
		function xpApplyBulk(updatedList) {
			for (var i = 0; i < updatedList.length; i++) {
				var u = updatedList[i];
				nativeApply(u);
				var markInp = document.querySelector(
					'input[name="mark_' + u.employeeId + '_' + u.date + '"]'
				);
				if (markInp) markInp.value = u.shortName || '';
			}
		}

		document.onchange = function (e) {
			e = e || window.event;
			var target = e.target || e.srcElement;
			if (!target || !target.name) return;
			if (target.name.indexOf('__') !== -1) return; // поля диалога «События сотрудника»
			var parts = target.name.split('_');
			if (parts.length < 3 || parts[0] !== 'mark') return;
			var empId = parts[1];
			var date = parts.slice(2).join('_');
			nativeSchedule(empId, date, target.value.toUpperCase());
		};

		// Enter в поле метки — немедленная отправка (таймер отменяется)
		document.onkeydown = function (e) {
			e = e || window.event;
			var target = e.target || e.srcElement;
			if (!target || !target.name) return;
			if (target.name.indexOf('__') !== -1) return; // поля диалога: сохранение только по кнопке
			var parts = target.name.split('_');
			if (parts.length < 3 || parts[0] !== 'mark') return;
			var key = e.keyCode || e.which;
			if (key !== 13) return;
			if (nativeTimers[target.name]) {
				clearTimeout(nativeTimers[target.name]);
				nativeTimers[target.name] = null;
			}
			nativeSend(parts[1], parts.slice(2).join('_'), target.value.toUpperCase());
			if (target.blur) target.blur();
			return false;
		};

		// Клик по строке часов — открыть диалог событий сотрудника
		document.onclick = function (e) {
			e = e || window.event;
			var el = e.target || e.srcElement;
			while (el && el.tagName) {
				if (el.className && el.className.indexOf('native-hours') !== -1) {
					var empId = el.getAttribute('data-empid');
					var y = el.getAttribute('data-year');
					var m = el.getAttribute('data-month');
					if (empId && typeof xpEmpOpen === 'function') {
						xpEmpOpen(empId, y, m);
					}
					return;
				}
				el = el.parentNode;
			}
		};
	</script>
</svelte:head>

<h1 class="native-title">Табель — {months[data.month - 1]} {data.year}</h1>

<!-- Носитель состояния для инлайн-скрипта (Svelte не интерполирует {…} в <script>) -->
<div id="tabel_state" data-actual={data.actual ? 1 : 0} style="display: none"></div>

<div class="native-navlinks">
	<a href={qs(nav.prev)}>
		<ArrowLeft size={14} style="vertical-align:middle" />&nbsp;{months[nav.prev.month - 1]}
	</a>
	<a href={qs({ year: data.year, month: data.month })}>Текущий месяц</a>
	<a href={qs(nav.next)}>
		{months[nav.next.month - 1]}&nbsp;<ArrowRight size={14} style="vertical-align:middle" />
	</a>
	<span class="native-sep">|</span>
	{#if data.actual}
		<a href={`?year=${data.year}&month=${data.month}&actual=0`}> Отчетное время </a>
	{:else}
		<a href={`?year=${data.year}&month=${data.month}&actual=1`}> Фактическое время </a>
	{/if}
	<span class="native-sep">|</span>
	{#if data.canEdit}
		{@html `<button type="button" class="native-btn native-btn-small" onclick="xpToggle('export_card')">Экспорт</button>`}
	{/if}
</div>

<div id="export_card" style="display: none">
	<Card title="Экспорт табеля">
		<form method="get" action="/native/apps/tabel/tabel/export" class="n-export-form">
			<input type="hidden" name="year" value={data.year} />
			<input type="hidden" name="month" value={data.month} />

			<div class="n-export-row">
				<Select name="calendarId" label="Календарь" options={calendarOptions} />
			</div>

			<Flex>
				<Checkbox name="showNight" label="Ночные" checked />
				<Checkbox name="showHoliday" label="Праздники" checked />
				<Checkbox name="showAbsence" label="Неявки" checked />
				<Checkbox name="showOvertime" label="Переработки" />
				<Checkbox name="autoAbsence" label="Автопропуски" />
				<Checkbox name="rounding" label="Округлять часы" />
			</Flex>

			<div class="n-export-round">
				<Input
					name="roundingPoint"
					label="Точка округления (ч)"
					type="number"
					step="0.1"
					value={String(roundingRules.roundingPoint ?? '')}
				/>
				<Input
					name="roundingFrom"
					label="От (ч)"
					type="number"
					step="0.1"
					value={String(roundingRules.roundingFrom ?? '')}
				/>
				<Input
					name="roundingTo"
					label="До (ч)"
					type="number"
					step="0.1"
					value={String(roundingRules.roundingTo ?? '')}
				/>
				<Input
					name="standardLeft"
					label="Сдвиг влево к стандарту (ч)"
					type="number"
					step="0.1"
					value={String(roundingRules.standardLeft ?? '')}
				/>
				<Input
					name="standardRight"
					label="Сдвиг вправо к стандарту (ч)"
					type="number"
					step="0.1"
					value={String(roundingRules.standardRight ?? '')}
				/>
			</div>

			<Button type="submit" size="sm">Скачать</Button>
		</form>
	</Card>
</div>

<div>
	{#each data.departments as group, gi}
		{@const id = `grp_${gi}`}
		{@const title = group.name}
		<Collapsible {id} {title}>
			{#each group.departments as dept, di}
				<SubCollapsible id={`dept_${gi}_${di}`} title={dept.name}>
					{#if data.canEdit}
						<div class="native-actions">{@html bulkBtn(dept)}</div>
					{/if}
					<div class="native-table-wrap">
						<table class="native-table">
							<thead>
								<tr>
									<th class="cell cell-head cell-left cell-sticky cell-num">т/н</th>
									<th class="cell cell-head cell-left cell-sticky cell-fio">ФИО</th>
									<th class="cell cell-head cell-total">Итого</th>
									<th class="cell cell-head cell-total">Ночь</th>
									{#each Array(data.lastDay) as _, i}
										<th class="cell cell-head cell-day">{i + 1}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each dept.employees as emp}
									{@const r = empRows(emp)}
									<tr
										class="native-hours"
										data-empid={emp.id}
										data-year={data.year}
										data-month={data.month}
									>
										<td class="cell cell-left cell-mono cell-sticky cell-num">{r.number}</td>
										<td class="cell cell-left cell-sticky cell-fio">{r.fio}</td>
										<td
											id="total_{r.id}"
											class="cell cell-total"
											data-minutes={r.totalReportMinutes}>{r.totalReport}</td
										>
										<td
											id="total_night_{r.id}"
											class="cell cell-total"
											data-minutes={r.totalNightMinutes}>{r.totalNight}</td
										>
										{#each Array(data.lastDay) as _, i}
											{@const c = r.cell(i + 1)}
											<td
												id="hours_{r.id}_{dateStr(i + 1)}"
												data-minutes={c?.minutes ?? 0}
												data-night={c?.minutesNight ?? 0}
												class="cell cell-day"
												style={c?.style ?? ''}>{c?.hours ?? ''}</td
											>
										{/each}
									</tr>
									<tr class="native-marks">
										<td class="cell cell-sticky cell-num"></td>
										<!-- Должность на дату сегмента (при отсутствии — пусто) -->
										<td class="cell cell-sticky cell-fio" style="color: #6b7280">
											{emp.positionName ?? ''}
										</td>
										<td class="cell cell-left" colspan="2"></td>
										{#each Array(data.lastDay) as _, i}
											{@const c = r.cell(i + 1)}
											<td
												id="cell_mark_{r.id}_{dateStr(i + 1)}"
												class="cell cell-day cell-mark"
												style={c?.style ?? ''}
											>
												{#if c?.blocked}
													<span class="native-blocked">×</span>
												{:else}
													<input
														type="text"
														name="mark_{r.id}_{dateStr(i + 1)}"
														value={c?.mark ?? ''}
														size="1"
														maxlength="3"
														class="native-input"
													/>
												{/if}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</SubCollapsible>
			{/each}
			{@html `<button class="native-btn native-btn-small" onclick="xpToggle('${esc(id)}')">Свернуть</button>`}
		</Collapsible>
	{/each}
</div>

{#if data.canEdit}
	{#each data.departments as group}
		{#each group.departments as dept}
			<BulkAssignNative
				{dept}
				dayMarks={data.dayMarks ?? []}
				calendarDays={data.calendarDays ?? {}}
				year={data.year}
				month={data.month}
				lastDay={data.lastDay}
			/>
		{/each}
	{/each}
{/if}

<EmployeeEventsNative canEdit={data.canEdit} />
