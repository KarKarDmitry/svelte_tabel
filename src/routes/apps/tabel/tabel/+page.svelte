<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { parse } from 'devalue';
	import { cellStyle } from '$lib/apps/tabel/utils/cell-style';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import DepartmentCard from './DepartmentCard.svelte';
	import EmployeeEventsModal from './EmployeeEventsModal.svelte';
	import ExportProgress from './ExportProgress.svelte';
	import BulkAssignDialog from './BulkAssignDialog.svelte';
	import MonthYearPicker from '$lib/components/DatetimePick/MonthYearPicker.svelte';

	import { Input } from '$lib/components/ui/input';
	import { Select, SelectTrigger, SelectContent, SelectItem } from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover';
	import { Separator } from '$lib/components/ui/separator';
	import CircleQuestionMarkIcon from '@lucide/svelte/icons/circle-question-mark';
	import { toast } from 'svelte-sonner';
	import { mode } from 'mode-watcher';

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

	// Единый источник данных — сихронизируем с page.data при навигации
	let data = $state(page.data);

	$effect(() => {
		data = page.data;
	});

	// Право на редактирование (корневой layout: admin | timekeeper)
	let canEdit = $derived(page.data.canEdit ?? false);

	// Всё остальное — производные от data
	let departments = $derived(data.departments);
	let dayMarks = $derived(data.dayMarks);
	let year = $derived(data.year);
	let month = $derived(data.month);
	let lastDay = $derived(data.lastDay);
	let isDark = $derived(mode.current === 'dark');
	// Правила расцветки: сервер отдаёт { light, dark } — выбираем по текущей теме
	let cellColorRules = $derived((data.cellColorRules ?? {})[isDark ? 'dark' : 'light'] ?? {});
	let markColorRules = $derived((data.markColorRules ?? {})[isDark ? 'dark' : 'light'] ?? {});
	let calendarDays = $derived<Record<string, { dayType: string; workTime: number | null }>>(
		data.calendarDays ?? {}
	);
	let shiftMarks = $derived<string[]>(data.shiftMarks ?? []);
	let calendars = $derived<any[]>(data.calendars ?? []);
	let schedulesById = $derived<
		Record<number, { standardWorkTime: number; weekDays: string | null }>
	>(data.schedulesById ?? {});

	// Состояние для модального окна событий
	let showEmployeeModal = $state(false);
	let modalEmployeeId = $state<number | null>(null);
	let modalDeptName = $state('');
	let modalPosName = $state('');

	// Быстрое назначение: один диалог на страницу, открывается для выбранного подразделения
	let bulkDept = $state<any>(null);
	let bulkOpen = $state(false);

	function openBulkAssign(dept: any) {
		bulkDept = dept;
		bulkOpen = true;
	}

	let cellPopup = $state<{
		x: number;
		y: number;
		dayData: any;
		empId: number;
	} | null>(null);

	// Фактическое время (rawWorkTime) вместо среза по графику (reportWorkTime)
	let showActual = $state(false);

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

	// Группируем департаменты по группам подразделений
	const groupedDepartments = $derived.by(() => {
		const groups = (data.departmentGroups ?? []) as any[];
		const grouped = groups
			.map((g) => {
				const deptIds = new Set(g.departments.map((m: any) => m.departmentId));
				return {
					id: g.id,
					name: g.name,
					departments: departments.filter((d: any) => deptIds.has(d.id))
				};
			})
			.filter((g) => g.departments.length > 0);

		// Департаменты без группы — в конце
		const inGroup = new Set(grouped.flatMap((g) => g.departments.map((d: any) => d.id)));
		const ungrouped = departments.filter((d: any) => !inGroup.has(d.id));
		if (ungrouped.length > 0) {
			grouped.push({ id: 0, name: 'Без группы', departments: ungrouped });
		}
		return grouped;
	});

	// --- Debounce: накапливаем изменения и отправляем пачкой с задержкой ---
	let pendingUpdates: Array<{ employeeId: number; date: string; shortName: string }> = $state([]);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function getCellColor(day: any, schedule: any): string {
		return cellStyle(day, schedule, {
			shiftMarks,
			calendarDays,
			schedulesById,
			cellColorRules,
			markColorRules
		});
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
		goto(`/apps/tabel/tabel?${params.toString()}`, { invalidateAll: true });
	}

	// Состояние для экспорта
	let exportOpen = $state(false);
	let exportStarted = $state(false);

	let exportSettings = $state({
		calendarId: '0',
		rounding: false,
		showNight: true,
		showOvertime: false,
		showHoliday: true,
		showAbsence: true,
		autoAbsence: false
	});

	// Параметры округления (заполняются из константы ROUNDING_RULES при открытии диалога)
	let roundingParams = $state({
		roundingPoint: '',
		roundingFrom: '',
		roundingTo: '',
		standardLeft: '',
		standardRight: ''
	});

	let exportEs: EventSource | null = null;
	const EXPORT_TOAST_ID = 'export-progress';

	function cancelExport() {
		exportEs?.close();
		exportEs = null;
		exportStarted = false;
		toast.dismiss(EXPORT_TOAST_ID);
	}

	const yearCalendars = $derived(calendars.filter((c: any) => c.year === year));
	const calendarLabel = $derived(
		yearCalendars.find((c: any) => String(c.id) === exportSettings.calendarId)?.name ??
			'Без календаря'
	);

	function openExportDialog() {
		// По умолчанию — основной календарь года
		const def = yearCalendars.find((c: any) => c.isDefault) ?? yearCalendars[0];
		exportSettings = {
			...exportSettings,
			calendarId: def ? String(def.id) : '0'
		};

		// Заполняем параметры округления из константы ROUNDING_RULES
		const rr = data.roundingRules as Record<string, unknown> | null;
		roundingParams = {
			roundingPoint: rr?.roundingPoint != null ? String(rr.roundingPoint) : '',
			roundingFrom: rr?.roundingFrom != null ? String(rr.roundingFrom) : '',
			roundingTo: rr?.roundingTo != null ? String(rr.roundingTo) : '',
			standardLeft: rr?.standardLeft != null ? String(rr.standardLeft) : '',
			standardRight: rr?.standardRight != null ? String(rr.standardRight) : ''
		};

		exportStarted = false;
		exportOpen = true;
	}

	async function exportExcel() {
		exportStarted = true;
		// Диалог параметров закрываем — прогресс показываем тостом
		exportOpen = false;

		const params = new URLSearchParams({
			year: String(year),
			month: String(month),
			showNight: exportSettings.showNight ? '1' : '0',
			showOvertime: exportSettings.showOvertime ? '1' : '0',
			showHoliday: exportSettings.showHoliday ? '1' : '0',
			showAbsence: exportSettings.showAbsence ? '1' : '0',
			rounding: exportSettings.rounding ? '1' : '0',
			autoAbsence: exportSettings.autoAbsence ? '1' : '0'
		});
		if (exportSettings.calendarId !== '0') params.set('calendarId', exportSettings.calendarId);
		if (exportSettings.rounding) {
			const num = (v: string, def: number | null) => (v === '' ? def : Number(v));
			params.set(
				'roundingParams',
				JSON.stringify({
					roundingPoint: num(roundingParams.roundingPoint, null),
					roundingFrom: num(roundingParams.roundingFrom, null),
					roundingTo: num(roundingParams.roundingTo, null),
					standardLeft: num(roundingParams.standardLeft, 0),
					standardRight: num(roundingParams.standardRight, 0)
				})
			);
		}

		const es = new EventSource(`/apps/tabel/tabel/export/stream?${params.toString()}`);
		exportEs = es;

		const showProgress = (data: any) =>
			toast.message(ExportProgress, {
				id: EXPORT_TOAST_ID,
				duration: Infinity,
				component: ExportProgress,
				componentProps: {
					progress: data.stage ?? data.progress ?? 'Формирование отчёта…',
					division: data.stage ? '' : data.division,
					employee: data.stage ? '' : data.employee,
					current: data.stage ? 0 : data.current,
					total: data.stage ? 0 : data.total,
					onCancel: cancelExport
				}
			});

		// Начальный тост — подготовка данных
		showProgress({ progress: 'Подготовка данных…' });

		es.onmessage = (e) => {
			const data = JSON.parse(e.data);

			if (data.type === 'done') {
				es.close();
				exportEs = null;
				exportStarted = false;
				toast.dismiss(EXPORT_TOAST_ID);
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
				toast.success(`Файл «${data.filename}» сформирован`);
			} else if (data.type === 'error') {
				es.close();
				exportEs = null;
				exportStarted = false;
				toast.dismiss(EXPORT_TOAST_ID);
				console.error(data.error);
				toast.error(data.error ?? 'Ошибка формирования отчёта');
			} else {
				showProgress(data);
			}
		};

		es.onerror = () => {
			es.close();
			exportEs = null;
			exportStarted = false;
			toast.dismiss(EXPORT_TOAST_ID);
			toast.error('Не удалось подключиться к серверу экспорта');
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
				headClass: isWeekend ? 'bg-destructive/10 text-destructive' : ''
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
			width: 60,
			align: 'center' as const,
			mono: true,
			render: totalCell
		},
		{
			key: 'totalNight',
			label: 'Ночь',
			width: 60,
			align: 'center' as const,
			mono: true,
			render: totalCell
		},
		...dayColumns(lastDay)
	]);
</script>

{#snippet employeeCell(_: any, row: TabelRow)}
	{#if row.type === 'mark'}
		<div class="h-9 border-muted-foreground px-1 text-muted-foreground">отметки</div>
	{:else}
		<div class="flex h-7 min-w-0 items-center gap-1 px-1">
			<div class="font-mono font-bold tabular-nums">
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
				class="m-0 h-9 w-full border-b-1 border-muted-foreground bg-[linear-gradient(to_bottom_right,transparent_48%,var(--muted-foreground)_48%,var(--muted-foreground)_52%,transparent_51%)]"
			></div>
		{:else if !canEdit}
			<div
				class="relative flex h-9 w-full items-center justify-center border-b-1 border-muted-foreground"
				style={styleStr ?? ''}
				title={value?.missingMinutes
					? `Недостача: ${formatHours(value.missingMinutes)}ч`
					: undefined}
			>
				<span class="truncate px-1">{value?.value ?? ''}</span>
				{#if value?.missingMinutes}
					<div
						class="pointer-events-none absolute right-0.5 bottom-0.5 text-[8px] text-amber-500 dark:text-amber-400"
					>
						{'\u25BC'}
					</div>
				{/if}
			</div>
		{:else}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div
				class="relative border-b-1 border-muted-foreground"
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
					<div
						class="pointer-events-none absolute right-0.5 bottom-0.5 text-[8px] text-amber-500 dark:text-amber-400"
					>
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

{#if cellPopup && canEdit}
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
						let msg: string | null = null;
						try {
							const j = JSON.parse(text);
							msg = j?.data?.message ?? j?.message ?? null;
						} catch {}
						toast.error(msg ?? 'Не удалось сохранить доп. метку');
					} else {
						toast.success('Доп. метка сохранена');
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
			<h1 class="flex flex-row gap-2 text-2xl font-bold tracking-tight">
				Табель
				<div class="flex items-center gap-2">
					<Switch bind:checked={showActual} id="show-actual" />
					<Label for="show-actual" class="cursor-pointer select-none">Фактическое время</Label>
				</div>
			</h1>
			<p class="text-sm text-muted-foreground">
				{months[month - 1]}
				{year}
			</p>
		</div>
		<!-- Навигация по месяцу/году -->
		<div class="flex items-center gap-1">
			<Button class="text-center" variant="outline" size="sm" onclick={() => goToMonth(-1)}>
				<ArrowLeft class="size-4" />
			</Button>

			<MonthYearPicker
				{year}
				{month}
				onChange={(y, m) => {
					const params = new URLSearchParams(page.url.searchParams);
					params.set('year', String(y));
					params.set('month', String(m));
					goto(`/apps/tabel/tabel?${params.toString()}`, { invalidateAll: true });
				}}
			/>

			<Button class="text-center" variant="outline" size="sm" onclick={() => goToMonth(1)}>
				<ArrowRight class="size-4" />
			</Button>
		</div>

		{#if canEdit}
			<Button size="sm" onclick={openExportDialog}>Экспорт</Button>
		{/if}
	</div>

	<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
		{#each groupedDepartments as group}
			<Collapsible class="group">
				<CollapsibleTrigger
					class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:bg-accent hover:text-foreground"
				>
					<Badge>{group.departments.length}</Badge>
					<span>{group.name}</span>
					<span class="h-px flex-1 bg-muted-foreground/50"></span>
					<ChevronDownIcon
						class="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
					/>
				</CollapsibleTrigger>

				<CollapsibleContent class="flex flex-col gap-2 pt-1 pl-2">
					{#each group.departments as dept}
						<DepartmentCard
							{dept}
							{columns}
							{dayMarks}
							{calendarDays}
							{schedulesById}
							{showActual}
							canEditDivision={canEdit}
							onRequestBulkAssign={openBulkAssign}
							onOpenEmployee={openEmployeeModal}
						/>
					{/each}
				</CollapsibleContent>
			</Collapsible>
		{/each}
	</div>
</div>

<EmployeeEventsModal
	bind:show={showEmployeeModal}
	employeeId={modalEmployeeId}
	{year}
	{month}
	departmentName={modalDeptName}
	positionName={modalPosName}
	readonly={!canEdit}
	onSave={onModalSave}
/>

<BulkAssignDialog
	bind:show={bulkOpen}
	bind:bulkDept
	dayMarks={[...dayMarks].sort((a: any, b: any) => a.shortName.localeCompare(b.shortName))}
	{calendarDays}
	{year}
	{month}
/>

<Dialog bind:open={exportOpen}>
	<DialogContent>
		<div class="flex flex-col gap-4">
			<p class="font-medium">Параметры экспорта</p>

			<!-- Календарь -->
			<div class="flex flex-col gap-1">
				<Label>Календарь</Label>
				<Select type="single" bind:value={exportSettings.calendarId}>
					<SelectTrigger class="w-full">
						<span>{calendarLabel}</span>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="0">Без календаря</SelectItem>
						{#each yearCalendars as c (c.id)}
							<SelectItem value={String(c.id)}>
								{c.name}{c.isDefault ? ' (основной)' : ''}
							</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<!-- Округление -->
			<div class="flex flex-col gap-1">
				<div class="flex items-center gap-2">
					<Label class="flex flex-row items-center gap-2 text-sm">
						<Checkbox bind:checked={exportSettings.rounding} />
						Округлять часы
					</Label>
					<Popover>
						<PopoverTrigger>
							{#snippet child({ props })}
								<button
									type="button"
									class="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									aria-label="Подсказка по округлению"
									{...props}
								>
									<CircleQuestionMarkIcon class="size-4" />
								</button>
							{/snippet}
						</PopoverTrigger>
						<PopoverContent class="w-80 text-xs" align="start">
							<div class="space-y-2">
								<p class="text-sm font-medium">Параметры округления</p>
								<p>
									Если фактическое время попало в интервал — показывается якорь, иначе — простое
									округление до целого часа.
								</p>
								<div class="rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
									roundingFrom &lt; факт &lt; roundingTo → roundingPoint
								</div>
								<p>
									<b>Точка округления</b> — абсолютное значение в часах, к которому «притягивается»
									время. <b>От / До</b> — границы интервала (ч).
								</p>
								<div class="rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
									стандарт + standardLeft &lt; факт &lt; стандарт + standardRight → стандарт
								</div>
								<p>
									<b>Сдвиг влево / вправо</b> — границы интервала относительно стандарта графика сотрудника
									(у каждого свой стандарт).
								</p>
							</div>
						</PopoverContent>
					</Popover>
				</div>
				<Collapsible open={exportSettings.rounding}>
					<CollapsibleContent>
						<div class="mt-2 grid grid-cols-2 items-center gap-2 rounded-md border p-3">
							<Label class="text-xs">Точка округления (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.roundingPoint} />
							<Label class="text-xs">От (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.roundingFrom} />
							<Label class="text-xs">До (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.roundingTo} />
							<Separator /><Separator />
							<Label class="text-xs">Сдвиг влево к стандарту (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.standardLeft} />
							<Label class="text-xs">Сдвиг вправо к стандарту (ч)</Label>
							<Input type="number" step="0.1" bind:value={roundingParams.standardRight} />
						</div>
					</CollapsibleContent>
				</Collapsible>
			</div>

			<!-- Флаги колонок -->
			<div class="flex flex-col gap-1 border-t pt-3">
				<span class="text-sm font-medium">Колонки отчёта</span>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showNight} />
					Выводить ночные
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showOvertime} />
					Выводить сверхурочные
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showHoliday} />
					Выводить праздничные
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.showAbsence} />
					Выводить коды неявок
				</Label>
				<Label class="flex flex-row items-center gap-2 text-sm">
					<Checkbox bind:checked={exportSettings.autoAbsence} />
					Автоматически выводить пропуска
				</Label>
			</div>

			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => (exportOpen = false)}>Отмена</Button>
				<Button onclick={exportExcel}>Экспортировать</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>
