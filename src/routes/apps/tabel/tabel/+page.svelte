<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { parse } from 'devalue';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible';
	import ETable from '$lib/components/ETable/ETable.svelte';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import EmployeeEventsModal from './EmployeeEventsModal.svelte';
	import MonthYearPicker from './MonthYearPicker.svelte';

	import { Input } from '$lib/components/ui/input';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';

	type TabelRow = {
		id: string;
		type: 'hours' | 'mark';
		empId: number;
		number: string;
		lastName: string;
		firstName: string;
		totalReport?: number;
		totalNight?: number;
		schedule?: any;
		[key: string]: any;
	};

	type DayMarkValue = {
		value: string;
		date: string;
		reportWorkTime: number | null;
		dayMarkCode: string;
		blocked?: boolean;
		missingMinutes?: number;
		extraMarkCode?: string | null;
		extraMarkMinutes?: number | null;
	};

	// Единый источник данных — сихронизируем с page.data при навигации
	let data = $state(page.data);

	$effect(() => {
		data = page.data;
	});

	// Всё остальное — производные от data
	let departments = $derived(data.departments);
	let dayMarks = $derived(data.dayMarks);
	let year = $derived(data.year);
	let month = $derived(data.month);
	let lastDay = $derived(data.lastDay);
	let total = $derived(data.total);
	let currentPage = $derived(data.page);
	let totalPages = $derived(data.totalPages);
	let cellColorRules = $derived(data.cellColorRules ?? {});
	let markColorRules = $derived(data.markColorRules ?? {});
	let calendarDays = $derived<Record<string, { dayType: string; workTime: number | null }>>(
		data.calendarDays ?? {}
	);
	let shiftMarks = $derived<string[]>(data.shiftMarks ?? []);
	let schedulesById = $derived<
		Record<number, { standardWorkTime: number; weekDays: string | null }>
	>(data.schedulesById ?? {});

	// Состояние для модального окна событий
	let showEmployeeModal = $state(false);
	let modalEmployeeId = $state<number | null>(null);
	let modalDeptName = $state('');
	let modalPosName = $state('');

	let cellPopup = $state<{
		x: number;
		y: number;
		dayData: any;
		empId: number;
	} | null>(null);

	function openEmployeeModal(empId: number) {
		for (const dept of data.departments as any[]) {
			for (const emp of dept.employees as any[]) {
				if (emp.id === empId) {
					modalDeptName = emp.departmentName ?? '';
					modalPosName = emp.positionName ?? '';
					modalEmployeeId = empId;
					showEmployeeModal = true;
					return;
				}
			}
		}
		modalEmployeeId = empId;
		showEmployeeModal = true;
	}

	function onModalSave(updates: Array<any>) {
		for (const u of updates) {
			patchDayData(u);
		}
	}

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

	function formatHours(minutes: number | null): string {
		if (minutes == null) return '';
		return (minutes / 60).toFixed(1);
	}

	function getDayMark(value: string): string {
		if (!value) return '';
		// Ищем по shortName (то что хранится в БД), затем по code для обратной совместимости
		const mark = dayMarks.find((m: any) => m.shortName === value || m.code === value);
		return mark?.shortName ?? value;
	}

	function buildRows(emp: any): TabelRow[] {
		const segKey = `${emp.segmentFrom || ''}-${emp.departmentId || 0}`;

		const hoursRow: TabelRow = {
			id: `${emp.id}-${segKey}-hours`,
			type: 'hours',
			empId: emp.id,
			number: emp.number,
			lastName: emp.lastName,
			firstName: emp.firstName,
			totalReport: emp.totalReport,
			totalNight: emp.totalNight
		};

		const markRow: TabelRow = {
			id: `${emp.id}-${segKey}-mark`,
			type: 'mark',
			empId: emp.id,
			number: '',
			lastName: '',
			firstName: '',
			schedule: emp.schedule
		};

		for (const [index, day] of emp.days.entries()) {
			const calDayForDate = day.date ? calendarDays[day.date] : null;
			const dayStdMin =
				day.scheduleId && schedulesById[day.scheduleId]
					? schedulesById[day.scheduleId].standardWorkTime
					: day.reportWorkTime && !day.scheduleId
						? (Object.values(schedulesById).find((s) => s.standardWorkTime === day.reportWorkTime)
								?.standardWorkTime ?? null)
						: null;
			const stdMin = calDayForDate?.workTime ?? dayStdMin ?? emp.schedule?.standardWorkTime;
			const hasShortage =
				day.reportWorkTime != null && stdMin != null && day.reportWorkTime < stdMin;
			hoursRow[`day_${index + 1}`] = formatHours(day.reportWorkTime);
			hoursRow[`day_${index + 1}_blocked`] = day.blocked ?? false;
			markRow[`day_${index + 1}`] = {
				value: getDayMark(day.dayMarkCode),
				date: day.date,
				reportWorkTime: day.reportWorkTime,
				dayMarkCode: day.dayMarkCode,
				blocked: day.blocked ?? false,
				missingMinutes: hasShortage ? stdMin - day.reportWorkTime : 0,
				extraMarkCode: day.extraMarkCode ?? null,
				extraMarkMinutes: day.extraMarkMinutes ?? null
			} satisfies DayMarkValue;
		}
		return [hoursRow, markRow];
	}

	const preparedDepartments = $derived.by(() => {
		return departments.map((dept: any) => ({
			...dept,
			rows: dept.employees.flatMap(buildRows)
		}));
	});

	// --- Debounce: накапливаем изменения и отправляем пачкой с задержкой ---
	let pendingUpdates: Array<{ employeeId: number; date: string; shortName: string }> = $state([]);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function getCellColor(day: any, schedule: any): string {
		if (!day) return '';

		// Заблокированные дни — без стиля, диагональ уже в inline
		if (day.blocked) return '';

		const isShift =
			shiftMarks.includes(day.dayMarkCode) || day.dayMarkCode === 'I' || day.dayMarkCode === 'N';
		const hasHours = day.reportWorkTime != null;
		const calDay = calendarDays[day.date];

		// Собираем CSS-стили
		const styles: string[] = [];

		// Спец-цвет для отметки
		const markRule = markColorRules[day.dayMarkCode];
		if (markRule) {
			if (markRule.bg) styles.push(`background-color:${markRule.bg}`);
			if (markRule.color) styles.push(`color:${markRule.color}`);
			if (markRule.fontWeight) styles.push(`font-weight:${markRule.fontWeight}`);
		}

		const expectedMinutes = (() => {
			// Если есть scheduleId из записи — используем его
			if (day.scheduleId && schedulesById[day.scheduleId]) {
				return schedulesById[day.scheduleId].standardWorkTime;
			}
			// Если scheduleId нет — пытаемся подобрать по reportWorkTime
			if (day.reportWorkTime && !day.scheduleId) {
				const matched = Object.values(schedulesById).find(
					(s) => s.standardWorkTime === day.reportWorkTime
				);
				if (matched) return matched.standardWorkTime;
			}
			// Падаем на календарь или текущий график сотрудника
			return calDay?.workTime ?? schedule?.standardWorkTime;
		})();

		// Кейс: сменная отметка без часов
		if (isShift && !hasHours && cellColorRules.missingHours?.bg) {
			styles.push(`background-color:${cellColorRules.missingHours.bg}`);
			return styles.join(';');
		}

		// Кейс: переработка / недоработка (с допуском 3 мин на погрешность)
		if (isShift && hasHours && expectedMinutes) {
			const diff = Math.abs(day.reportWorkTime - expectedMinutes);
			if (diff > 3) {
				if (day.reportWorkTime > expectedMinutes && cellColorRules.overwork?.bg) {
					styles.push(`background-color:${cellColorRules.overwork.bg}`);
					return styles.join(';');
				}
				if (day.reportWorkTime < expectedMinutes && cellColorRules.underwork?.bg) {
					styles.push(`background-color:${cellColorRules.underwork.bg}`);
					return styles.join(';');
				}
			}
		}

		// Кейс: работа в нерабочий день
		if (isShift && calDay) {
			const isNonWorkDay = calDay.dayType === 'weekend' || calDay.dayType === 'holiday';
			if (isNonWorkDay && cellColorRules.weekendWork?.bg) {
				styles.push(`background-color:${cellColorRules.weekendWork.bg}`);
				return styles.join(';');
			}
		}

		if (isShift && !calDay && schedule?.weekDays) {
			const jsDay = new Date(day.date).getDay();
			const wdDay = jsDay === 0 ? 7 : jsDay;
			try {
				const workDays: number[] = JSON.parse(schedule.weekDays);
				if (!workDays.includes(wdDay) && cellColorRules.weekendWork?.bg) {
					styles.push(`background-color:${cellColorRules.weekendWork.bg}`);
					return styles.join(';');
				}
			} catch {}
		}

		// Кейс: пропущенный рабочий день
		if (!day.dayMarkCode && !hasHours) {
			if (calDay) {
				const isWorkDay =
					calDay.dayType === 'workday' ||
					calDay.dayType === 'preholiday' ||
					calDay.dayType === 'transferred_workday';
				if (isWorkDay && cellColorRules.missedWorkday?.bg) {
					styles.push(`background-color:${cellColorRules.missedWorkday.bg}`);
					return styles.join(';');
				}
			} else if (schedule?.weekDays) {
				const jsDay = new Date(day.date).getDay();
				const wdDay = jsDay === 0 ? 7 : jsDay;
				try {
					const workDays: number[] = JSON.parse(schedule.weekDays);
					if (workDays.includes(wdDay) && cellColorRules.missedWorkday?.bg) {
						styles.push(`background-color:${cellColorRules.missedWorkday.bg}`);
						return styles.join(';');
					}
				} catch {}
			}
		}

		return styles.join(';');
	}

	function queueUpdate(employeeId: number, date: string, shortName: string) {
		// Убираем предыдущее ожидающее изменение для того же сотрудника/даты
		pendingUpdates = pendingUpdates.filter(
			(u) => !(u.employeeId === employeeId && u.date === date)
		);
		pendingUpdates = [...pendingUpdates, { employeeId, date, shortName }];

		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(flushUpdates, 600);
	}

	async function flushUpdates() {
		if (pendingUpdates.length === 0) return;
		const batch = pendingUpdates;
		pendingUpdates = [];
		debounceTimer = null;

		// Отправляем только последнее изменение по каждому сотруднику+дате
		const latest = new Map<string, { employeeId: number; date: string; shortName: string }>();
		for (const u of batch) {
			latest.set(`${u.employeeId}-${u.date}`, u);
		}

		try {
			console.log('[WTT] flushUpdates batch', batch.length, 'items');

			const responses = await Promise.all(
				Array.from(latest.values()).map((u) =>
					fetch('/apps/tabel/tabel?/updateDayMark', {
						method: 'POST',
						body: new URLSearchParams({
							employeeId: String(u.employeeId),
							date: u.date,
							shortName: u.shortName
						})
					})
				)
			);

			console.log('[WTT] responses received', responses.length);

			// Реактивно обновляем локальное состояние из ответа сервера
			for (const res of responses) {
				if (!res.ok) {
					console.warn('[WTT] response not ok', res.status);
					continue;
				}
				const result = await res.json();
				console.log('[WTT] raw response', result);

				// SvelteKit сериализует ответ action через devalue
				// result.data — devalue-строка, парсим её
				let actionData: any;
				if (typeof result?.data === 'string') {
					actionData = parse(result.data);
				} else {
					actionData = result?.data ?? result;
				}

				const updated = actionData?.updated;
				if (!updated) {
					console.warn('[WTT] no updated data in response');
					continue;
				}
				console.log('[WTT] patching dayData', updated);
				patchDayData(updated);
			}
		} catch {
			// При ошибке восстанавливаем отложенные изменения
			pendingUpdates = [...pendingUpdates, ...batch];
		}
	}

	/** Обновить локальные данные после сохранения отметки */
	function patchDayData(updated: {
		employeeId: number;
		date: string;
		reportWorkTime: number | null;
		reportNightWorkTime: number | null;
		dayMarkCode: string | null;
		extraMarkCode?: string | null;
		extraMarkMinutes?: number | null;
	}) {
		for (const dept of data.departments as any[]) {
			for (const emp of dept.employees as any[]) {
				if (emp.id !== updated.employeeId) continue;

				let totalReport = 0;
				let totalNight = 0;

				console.log('[WTT] patchDayData found emp', emp.id, emp.lastName, 'days', emp.days.length);

				for (const day of emp.days as any[]) {
					if (day.date === updated.date) {
						console.log('[WTT] patching day', day.date, 'old:', {
							rwt: day.reportWorkTime,
							rnwt: day.reportNightWorkTime,
							dmc: day.dayMarkCode
						});
						day.reportWorkTime = updated.reportWorkTime;
						day.reportNightWorkTime = updated.reportNightWorkTime;
						day.dayMarkCode = updated.dayMarkCode ?? '';
						if (updated.extraMarkCode !== undefined) day.extraMarkCode = updated.extraMarkCode;
						if (updated.extraMarkMinutes !== undefined)
							day.extraMarkMinutes = updated.extraMarkMinutes;
						console.log('[WTT] patching day', day.date, 'new:', {
							rwt: day.reportWorkTime,
							rnwt: day.reportNightWorkTime,
							dmc: day.dayMarkCode
						});
					}
					totalReport += day.reportWorkTime ?? day.shiftWorkTime ?? 0;
					totalNight += day.reportNightWorkTime ?? day.shiftNightWorkTime ?? 0;
				}

				console.log('[WTT] new totals', {
					totalReport,
					totalNight,
					old: { tr: emp.totalReport, tn: emp.totalNight }
				});
				emp.totalReport = totalReport;
				emp.totalNight = totalNight;
				return;
			}
		}

		console.warn('[WTT] employee not found in local data', updated.employeeId);
	}

	// --- Навигация по дате ---
	function goToMonth(delta: number) {
		let m = month + delta;
		let y = year;
		if (m < 1) {
			m = 12;
			y--;
		}
		if (m > 12) {
			m = 1;
			y++;
		}
		const params = new URLSearchParams(page.url.searchParams);
		params.set('year', String(y));
		params.set('month', String(m));
		params.set('page', '1');
		goto(`/apps/tabel/tabel?${params.toString()}`, { invalidateAll: true });
	}

	function goToPage(p: number) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('page', String(p));
		goto(`/apps/tabel/tabel?${params.toString()}`, { invalidateAll: true });
	}

	// Состояние для экспорта
	let exportOpen = $state(false);
	let exportProgress = $state('');
	let exportDivision = $state('');
	let exportEmployee = $state('');
	let exportCurrent = $state(0);
	let exportTotal = $state(0);

	async function exportExcel() {
		exportOpen = true;
		exportProgress = 'Подготовка данных...';
		exportDivision = '';
		exportEmployee = '';
		exportCurrent = 0;
		exportTotal = 0;

		const es = new EventSource(`/apps/tabel/tabel/export/stream?year=${year}&month=${month}`);

		es.onmessage = (e) => {
			const data = JSON.parse(e.data);

			if (data.type === 'done') {
				es.close();
				// Скачиваем файл
				const byteChars = atob(data.base64);
				const byteNums = new Array(byteChars.length);
				for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
				const blob = new Blob([new Uint8Array(byteNums)], {
					type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
				});
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = data.filename;
				a.click();
				URL.revokeObjectURL(url);
				exportOpen = false;
			} else if (data.type === 'error') {
				es.close();
				exportOpen = false;
				console.error(data.error);
			} else {
				exportProgress = 'Формирование отчёта...';
				exportDivision = data.division;
				exportEmployee = data.employee;
				exportCurrent = data.current;
				exportTotal = data.total;
			}
		};

		es.onerror = () => {
			es.close();
			exportOpen = false;
		};
	}

	function dayColumns(lastDay: number) {
		return Array.from({ length: lastDay }, (_, i) => {
			const day = i + 1;
			const jsDay = new Date(year, month - 1, day).getDay();
			const isWeekend = jsDay === 0 || jsDay === 6;

			return {
				key: `day_${day}`,
				label: String(day),
				width: 44,
				align: 'center' as const,
				mono: true,
				render: dayCell,
				headClass: isWeekend ? 'bg-red-50 text-red-700' : ''
			};
		});
	}

	let columns = $derived([
		{
			key: 'employee',
			label: 'т/н - ФИО',
			width: 250,
			sticky: true,
			render: employeeCell
		},
		{
			key: 'totalReport',
			label: 'Итого',
			width: 90,
			align: 'center' as const,
			mono: true,
			render: totalCell
		},
		{
			key: 'totalNight',
			label: 'Ночных',
			width: 90,
			align: 'center' as const,
			mono: true,
			render: totalCell
		},
		...dayColumns(lastDay)
	]);
</script>

{#snippet employeeCell(_: any, row: TabelRow)}
	{#if row.type === 'mark'}
		<div class="h-7 px-1 text-muted-foreground">отметки</div>
	{:else}
		<div class="flex h-7 min-w-0 items-center gap-1 px-1">
			<div class="shrink-0 font-mono tabular-nums">
				{row.number}
			</div>
			-
			<div class="min-w-0 truncate">
				{row.lastName}
				{row.firstName}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet totalCell(value: any, row: TabelRow)}
	{#if row.type === 'hours'}
		<div class="text-center font-medium tabular-nums">
			{formatHours(value) || '—'}
		</div>
	{/if}
{/snippet}

{#snippet dayCell(value: any, row: TabelRow, col: any)}
	{@const styleStr = getCellColor(value, row.schedule)}
	{#if row.type === 'mark'}
		{#if value?.blocked}
			<div
				class="m-0 h-9 w-full bg-[linear-gradient(to_bottom_right,transparent_48%,var(--muted-foreground)_48%,var(--muted-foreground)_52%,transparent_51%)]"
			></div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div
				class="relative"
				onclick={(e) => {
					if (value?.missingMinutes) {
						const r = e.currentTarget.getBoundingClientRect();
						cellPopup = {
							x: r.left,
							y: r.bottom + 4,
							dayData: value,
							empId: row.empId
						};
					}
				}}
			>
				<Input
					class="m-0 h-9 w-full rounded-none border-none p-0 text-center"
					style={styleStr ?? ''}
					value={value?.value ?? ''}
					onchange={(e) => queueUpdate(row.empId, value.date, e.currentTarget.value.toUpperCase())}
				/>
				{#if value?.missingMinutes}
					<div class="pointer-events-none absolute right-0.5 bottom-0.5 text-[8px] text-amber-500">
						{'\u25BC'}
					</div>
				{/if}
			</div>
		{/if}
	{:else}
		<div class="text-center tabular-nums" style={styleStr}>
			{typeof value === 'object' ? (value?.value ?? '') : (value ?? '')}
		</div>
	{/if}
{/snippet}

{#if cellPopup}
	{@const cp = cellPopup}
	<!-- svelte-ignore a11y_no_dynamic_element_interactions a11y_click_events_have_key_events -->
	<div
		class="fixed z-50 flex flex-col gap-2 rounded-xl border bg-popover p-3 shadow-lg"
		style="left: {cp.x}px; top: {cp.y}px;"
		role="dialog"
	>
		<span class="text-xs text-muted-foreground">
			Недостача: {formatHours(cp.dayData.missingMinutes)}ч
		</span>
		<div class="flex flex-col gap-1">
			<Input
				class="h-7 w-28 text-center text-xs text-muted-foreground italic"
				placeholder="Доп.метка"
				value={cp.dayData.extraMarkCode ?? ''}
				oninput={(e) => {
					cp.dayData.extraMarkCode = e.currentTarget.value.toUpperCase() || null;
				}}
			/>
			<Input
				type="number"
				step="0.1"
				class="h-7 w-28 text-center text-xs text-muted-foreground italic"
				placeholder="Часов"
				value={Number(
					((cp.dayData.extraMarkMinutes ?? cp.dayData.missingMinutes ?? 0) / 60).toFixed(1)
				)}
				oninput={(e) => {
					const n = parseFloat(e.currentTarget.value);
					cp.dayData.extraMarkMinutes = isNaN(n) ? null : Math.round(n * 60);
				}}
			/>
			<Button
				size="sm"
				class="h-7 text-xs"
				onclick={async () => {
					console.log('[WTT] save click', cp.dayData.date, cp.empId);
					const extraCode = cp.dayData.extraMarkCode?.trim() || '';
					const extraMin = cp.dayData.extraMarkMinutes ?? cp.dayData.missingMinutes ?? 0;
					const res = await fetch('/apps/tabel/tabel?/updateExtraMark', {
						method: 'POST',
						body: new URLSearchParams({
							employeeId: String(cp.empId),
							date: cp.dayData.date,
							extraMarkCode: extraCode,
							extraMarkMinutes: String(extraMin)
						})
					});
					console.log('[WTT] save response', res.status);
					if (!res.ok) {
						const text = await res.text();
						console.error('[WTT] save failed', res.status, text.substring(0, 200));
					}
					cellPopup = null;
				}}>Сохранить</Button
			>
		</div>
	</div>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" onclick={() => (cellPopup = null)} onkeydown={() => {}}></div>
{/if}

<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="mb-2 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Табель</h1>
			<p class="text-sm text-muted-foreground">
				{months[month - 1]}
				{year}
			</p>
		</div>
		<!-- Навигация по месяцу/году -->
		<div class="flex items-center gap-1">
			<Button class="text-center" variant="outline" size="sm" onclick={() => goToMonth(-1)}>
				←
			</Button>

			<MonthYearPicker
				{year}
				{month}
				onChange={(y, m) => {
					const params = new URLSearchParams(page.url.searchParams);
					params.set('year', String(y));
					params.set('month', String(m));
					params.set('page', '1');
					goto(`/apps/tabel/tabel?${params.toString()}`, { invalidateAll: true });
				}}
			/>

			<Button class="text-center" variant="outline" size="sm" onclick={() => goToMonth(1)}>
				→
			</Button>
		</div>

		<Button size="sm" onclick={exportExcel}>Экспорт</Button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
		{#each preparedDepartments as dept}
			<Collapsible class="overflow-hidden rounded-2xl border bg-card shadow-sm">
				<CollapsibleTrigger
					class="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
				>
					<div class="font-semibold">
						{dept.name}
					</div>

					<Badge>
						{dept.employees.length}
					</Badge>
				</CollapsibleTrigger>

				<CollapsibleContent class="border-y">
					<div class="overflow-auto">
						<ETable
							data={dept.rows}
							{columns}
							getRowId={(row) => row.id}
							rowClass={(row) =>
								row.type === 'mark' ? 'bg-muted/10 text-[11px]' : 'hover:bg-muted/20'}
							onRowClick={(row) => {
								if (row.type === 'hours') openEmployeeModal(row.empId);
							}}
						/>
					</div>
				</CollapsibleContent>
			</Collapsible>
		{/each}

		<!-- Пагинация -->
		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 py-4">
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					onclick={() => goToPage(currentPage - 1)}
				>
					← Назад
				</Button>

				<div class="flex items-center gap-1">
					{#each { length: totalPages } as _, i}
						{@const p = i + 1}
						{#if p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2}
							<Button
								variant={p === currentPage ? 'default' : 'outline'}
								size="sm"
								class="min-w-8"
								onclick={() => goToPage(p)}
							>
								{p}
							</Button>
						{:else if p === currentPage - 3 || p === currentPage + 3}
							<span class="px-1 text-muted-foreground">...</span>
						{/if}
					{/each}
				</div>

				<Button
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					onclick={() => goToPage(currentPage + 1)}
				>
					Вперед →
				</Button>
			</div>

			<div class="text-center text-xs text-muted-foreground">
				Страница {currentPage} из {totalPages} · Всего сотрудников: {total}
			</div>
		{/if}
	</div>
</div>

<EmployeeEventsModal
	show={showEmployeeModal}
	employeeId={modalEmployeeId}
	{year}
	{month}
	departmentName={modalDeptName}
	positionName={modalPosName}
	onSave={onModalSave}
/>

<Dialog bind:open={exportOpen}>
	<DialogContent>
		<div class="flex flex-col items-center gap-4 py-6">
			<div class="text-sm font-medium">{exportProgress}</div>

			{#if exportDivision}
				<div class="text-xs text-muted-foreground">{exportDivision}</div>
			{/if}
			{#if exportEmployee}
				<div class="text-xs text-muted-foreground">{exportEmployee}</div>
			{/if}

			<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					class="h-full rounded-full bg-primary transition-all duration-300"
					style="width: {exportTotal > 0 ? (exportCurrent / exportTotal) * 100 : 50}%"
				></div>
			</div>

			{#if exportTotal > 0}
				<div class="text-xs text-muted-foreground">
					{exportCurrent} / {exportTotal}
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
