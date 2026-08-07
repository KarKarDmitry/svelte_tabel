<script lang="ts">
	import { page } from '$app/stores';
	import { Grid, GridItem, EmptyState } from '$lib/components/native/ui';

	const data = $derived($page.data);

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

	/** Расцветка ячейки — как в оригинальной модалке (EmployeeEventsModal.getCellStyle) */
	function getCellStyle(day: any): string {
		if (!day) return '';
		const style: string[] = [];
		const calDay = (data.calendarDays ?? {})[day.date];
		const markColorRules: any = data.markColorRules ?? {};
		const cellColorRules: any = data.cellColorRules ?? {};
		const shiftMarks: string[] = data.shiftMarks ?? [];
		const empSchedule: any = data.empSchedule ?? null;

		const markRule = markColorRules[day.dayMarkCode];
		if (markRule) {
			if (markRule.bg) style.push(`background-color:${markRule.bg}`);
			if (markRule.color) style.push(`color:${markRule.color}`);
			if (markRule.fontWeight) style.push(`font-weight:${markRule.fontWeight}`);
		}

		const isShift =
			shiftMarks.includes(day.dayMarkCode) || day.dayMarkCode === 'I' || day.dayMarkCode === 'N';
		// Отчётные часы приоритетны; если табельщик их ещё не проставил — берём сменные из импорта
		const workMinutes = day.reportWorkTime ?? day.shiftWorkTime;
		const hasHours = workMinutes != null;
		const expectedMinutes = calDay?.workTime ?? empSchedule?.standardWorkTime;

		if (isShift && !hasHours && cellColorRules.missingHours?.bg) {
			style.push(`background-color:${cellColorRules.missingHours.bg}`);
			return style.join(';');
		}
		if (isShift && hasHours && expectedMinutes) {
			const diff = Math.abs(workMinutes - expectedMinutes);
			if (diff > 3) {
				if (workMinutes > expectedMinutes && cellColorRules.overwork?.bg) {
					style.push(`background-color:${cellColorRules.overwork.bg}`);
					return style.join(';');
				}
				if (workMinutes < expectedMinutes && cellColorRules.underwork?.bg) {
					style.push(`background-color:${cellColorRules.underwork.bg}`);
					return style.join(';');
				}
			}
		}
		if (isShift) {
			if (calDay) {
				const isNonWorkDay = calDay.dayType === 'weekend' || calDay.dayType === 'holiday';
				if (isNonWorkDay && cellColorRules.weekendWork?.bg) {
					style.push(`background-color:${cellColorRules.weekendWork.bg}`);
					return style.join(';');
				}
			} else if (empSchedule?.weekDays) {
				const jsDay = new Date(day.date).getDay();
				const wdDay = jsDay === 0 ? 7 : jsDay;
				try {
					const workDays: number[] = JSON.parse(empSchedule.weekDays);
					if (!workDays.includes(wdDay) && cellColorRules.weekendWork?.bg) {
						style.push(`background-color:${cellColorRules.weekendWork.bg}`);
						return style.join(';');
					}
				} catch {}
			}
		}
		if (!day.dayMarkCode && !hasHours) {
			if (calDay) {
				const isWorkDay =
					calDay.dayType === 'workday' ||
					calDay.dayType === 'preholiday' ||
					calDay.dayType === 'transferred_workday';
				if (isWorkDay && cellColorRules.missedWorkday?.bg) {
					style.push(`background-color:${cellColorRules.missedWorkday.bg}`);
					return style.join(';');
				}
			} else if (empSchedule?.weekDays) {
				const jsDay = new Date(day.date).getDay();
				const wdDay = jsDay === 0 ? 7 : jsDay;
				try {
					const workDays: number[] = JSON.parse(empSchedule.weekDays);
					if (workDays.includes(wdDay) && cellColorRules.missedWorkday?.bg) {
						style.push(`background-color:${cellColorRules.missedWorkday.bg}`);
						return style.join(';');
					}
				} catch {}
			}
		}
		return style.join(';');
	}

	function fmt(val: number | null): string {
		if (val == null) return '';
		return (val / 60).toFixed(1);
	}
</script>

<svelte:head>
	<script>
		function nativeSaveEmployee() {
			var root = document.getElementById('empRoot');
			var EMP_ID = root.getAttribute('data-empid');
			var EMP_YEAR = root.getAttribute('data-year');
			var EMP_MONTH = root.getAttribute('data-month');
			var byDate = {};
			var FIELDS = {
				hours: 'reportWorkTime',
				night: 'reportNightWorkTime',
				mark: 'dayMarkCode',
				extra: 'extraMarkCode',
				extraHours: 'extraMarkMinutes'
			};
			var inputs = document.getElementsByTagName('input');
			for (var i = 0; i < inputs.length; i++) {
				var name = inputs[i].name;
				if (!name) continue;
				var idx = name.indexOf('__');
				if (idx < 0) continue;
				var field = name.substring(0, idx);
				var date = name.substring(idx + 2);
				if (!FIELDS[field]) continue;
				if (!byDate[date]) byDate[date] = {};
				byDate[date][FIELDS[field]] = inputs[i].value;
			}
			var days = [];
			for (var d in byDate) {
				var day = byDate[d];
				var hours = parseFloat(day.reportWorkTime);
				var night = parseFloat(day.reportNightWorkTime);
				var extraH = parseFloat(day.extraMarkMinutes);
				days.push({
					date: d,
					reportWorkTime: isNaN(hours) ? null : Math.round(hours * 60),
					reportNightWorkTime: isNaN(night) ? null : Math.round(night * 60),
					dayMarkCode: (day.dayMarkCode || '').trim().toUpperCase(),
					extraMarkCode: (day.extraMarkCode || '').trim() || null,
					extraMarkMinutes: isNaN(extraH) ? null : Math.round(extraH * 60)
				});
			}
			var xhr = new XMLHttpRequest();
			xhr.open('POST', '/apps/tabel/tabel/employee-events', true);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onreadystatechange = function () {
				if (xhr.readyState !== 4) return;
				if (xhr.status === 200) {
					alert('Сохранено');
					location.reload();
				} else {
					alert('Ошибка сохранения (' + xhr.status + ')');
				}
			};
			xhr.send(
				JSON.stringify({
					employeeId: EMP_ID,
					year: EMP_YEAR,
					month: EMP_MONTH,
					days: days
				})
			);
		}
	</script>
</svelte:head>

<div
	id="empRoot"
	data-empid={data.employeeId}
	data-year={data.year}
	data-month={data.month}
	style="display: none"
></div>

<h1 class="native-title">
	События сотрудника:
	{data.employee?.lastName}
	{data.employee?.firstName}
	{data.employee?.middleName ?? ''}
</h1>

<p class="native-note">
	Табельный номер: {data.employee?.number} · Должность: {data.positionName ?? '—'} · Подразделение: {data.departmentName ??
		'—'} · Данные за {months[data.month - 1]}
	{data.year}
</p>

<Grid cols={2}>
	<GridItem>
		<h2 class="native-subtitle">События турникета</h2>
		{#if data.turnstileEvents.length === 0}
			<EmptyState text="Нет событий турникета за этот месяц" />
		{:else}
			<table class="native-table native-table-employee">
				<thead>
					<tr>
						<th class="cell cell-head cell-left">Дата и время</th>
						<th class="cell cell-head cell-left">Событие</th>
						<th class="cell cell-head">Пропуск</th>
					</tr>
				</thead>
				<tbody>
					{#each data.turnstileEvents as ev}
						<tr>
							<td class="cell cell-left cell-mono">
								{new Date(ev.datetime).toLocaleString('ru-RU', {
									day: '2-digit',
									month: '2-digit',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}
							</td>
							<td class="cell cell-left">{ev.eventName}</td>
							<td class="cell cell-mono"
								>{ev.passSeria ? `${ev.passSeria} ${ev.passNumber}` : ev.passNumber}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</GridItem>
	<GridItem>
		<h2 class="native-subtitle">Метки по дням</h2>
		<table class="native-table native-table-employee">
			<thead>
				<tr>
					<th class="cell cell-head">День</th>
					<th class="cell cell-head">Часов</th>
					<th class="cell cell-head">Ночных</th>
					<th class="cell cell-head">Метка</th>
					<th class="cell cell-head">Доп.метка</th>
					<th class="cell cell-head">Час.доп</th>
				</tr>
			</thead>
			<tbody>
				{#each data.days as day, i}
					{@const style = getCellStyle(day)}
					<tr>
						<td class="cell">{i + 1}</td>
						{#if data.canEdit}
							<td class="cell"
								><input
									type="text"
									name="hours__{day.date}"
									value={fmt(day.reportWorkTime)}
									class="native-input"
								/></td
							>
							<td class="cell"
								><input
									type="text"
									name="night__{day.date}"
									value={fmt(day.reportNightWorkTime)}
									class="native-input"
								/></td
							>
							<td class="cell" {style}
								><input
									type="text"
									name="mark__{day.date}"
									value={day.dayMarkCode ?? ''}
									maxlength="3"
									class="native-input"
								/></td
							>
							<td class="cell"
								><input
									type="text"
									name="extra__{day.date}"
									value={day.extraMarkCode ?? ''}
									maxlength="3"
									class="native-input"
								/></td
							>
							<td class="cell"
								><input
									type="text"
									name="extraHours__{day.date}"
									value={fmt(day.extraMarkMinutes)}
									class="native-input"
								/></td
							>
						{:else}
							<td class="cell">{fmt(day.reportWorkTime)}</td>
							<td class="cell">{fmt(day.reportNightWorkTime)}</td>
							<td class="cell" {style}>{day.dayMarkCode ?? ''}</td>
							<td class="cell">{day.extraMarkCode ?? ''}</td>
							<td class="cell">{fmt(day.extraMarkMinutes)}</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>

		{#if data.canEdit}
			<div class="native-actions">
				{@html `<button type="button" class="native-btn" onclick="nativeSaveEmployee()">Сохранить</button>`}
			</div>
		{/if}
	</GridItem>
</Grid>
