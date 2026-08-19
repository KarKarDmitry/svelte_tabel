<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
	import ETable from '$lib/components/ETable/ETable.svelte';
	import { toast } from 'svelte-sonner';
	import { mode } from 'mode-watcher';

	let {
		show = $bindable(false),
		employeeId,
		year,
		month,
		departmentName = '',
		positionName = '',
		readonly = false,
		onSave
	}: {
		show: boolean;
		employeeId: number | null;
		year: number;
		month: number;
		departmentName?: string;
		positionName?: string;
		/** Только просмотр (нет права на редактирование) */
		readonly?: boolean;
		onSave?: (
			updates: Array<{
				employeeId: number;
				date: string;
				reportWorkTime: number | null;
				reportNightWorkTime: number | null;
				dayMarkCode: string | null;
				extraMarkCode?: string | null;
				extraMarkMinutes?: number | null;
			}>
		) => void;
	} = $props();

	let open = $state(false);
	let loading = $state(false);
	let saving = $state(false);
	let isDark = $derived(mode.current === 'dark');
	let employee: any = $state(null);
	let days = $state<
		Array<{
			date: string;
			reportWorkTime: number | null;
			reportNightWorkTime: number | null;
			shiftWorkTime: number | null;
			shiftNightWorkTime: number | null;
			dayMarkCode: string;
			extraMarkCode: string | null;
			extraMarkMinutes: number | null;
		}>
	>([]);
	let lastDay = $state(0);
	let cellColorRules: any = $state({});
	let markColorRules: any = $state({});
	let shiftMarks: string[] = $state([]);
	let calendarDays: any = $state({});
	let empSchedule: any = $state(null);
	let turnstileEvents = $state<
		Array<{
			datetime: string;
			eventName: string;
			passSeria: string | null;
			passNumber: string;
		}>
	>([]);

	function getCellStyle(day: any): string {
		if (!day) return '';

		const style: string[] = [];
		const calDay = calendarDays[day.date];

		// Спец-цвет для отметки
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

		// Сменная отметка без часов
		if (isShift && !hasHours && cellColorRules.missingHours?.bg) {
			style.push(`background-color:${cellColorRules.missingHours.bg}`);
			return style.join(';');
		}

		// Переработка / недоработка (с допуском 3 мин)
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

		// Работа в нерабочий день (выходной/праздник)
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

		// Пропущенный рабочий день
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

	/** Часы ячейки: отчётные или сменные из импорта (звёздочка — в колонке «День») */
	function hoursText(day: any): string {
		if (day?.reportWorkTime != null) return fmt(day.reportWorkTime);
		if (day?.shiftWorkTime != null) return fmt(day.shiftWorkTime);
		return '';
	}

	function nightText(day: any): string {
		if (day?.reportNightWorkTime != null) return fmt(day.reportNightWorkTime);
		if (day?.shiftNightWorkTime != null) return fmt(day.shiftNightWorkTime);
		return '';
	}

	function parseHours(val: string): number | null {
		const n = parseFloat(val);
		if (isNaN(n)) return null;
		return Math.round(n * 60);
	}

	type DayRow = {
		id: number;
		dayNum: number;
		dayData: (typeof days)[number];
	};

	let rows = $derived(
		Array.from({ length: lastDay }, (_, i) => ({
			id: i + 1,
			dayNum: i + 1,
			dayData: days[i]
		}))
	);

	$effect(() => {
		if (show && !open) {
			open = true;
			loadData();
		}
		if (!show && open) {
			open = false;
		}
	});

	async function loadData() {
		loading = true;
		try {
			const res = await fetch(
				`/apps/tabel/tabel/employee-events?employeeId=${employeeId}&year=${year}&month=${month}`
			);
			if (!res.ok) throw new Error('Failed to load');
			const data = await res.json();
			employee = data.employee;
			days = data.days;
			lastDay = data.lastDay;
			cellColorRules = (data.cellColorRules ?? {})[isDark ? 'dark' : 'light'] ?? {};
			markColorRules = (data.markColorRules ?? {})[isDark ? 'dark' : 'light'] ?? {};
			calendarDays = data.calendarDays ?? {};
			empSchedule = data.empSchedule ?? null;
			turnstileEvents = data.turnstileEvents ?? [];
			shiftMarks = data.shiftMarks ?? [];
		} catch (e) {
			console.error('[WTT] load events error', e);
		} finally {
			loading = false;
		}
	}

	async function save() {
		saving = true;
		try {
			const body = days
				.filter(
					(d) =>
						d.dayMarkCode.trim() ||
						d.reportWorkTime != null ||
						d.reportNightWorkTime != null ||
						d.extraMarkCode?.trim()
				)
				.map((d) => ({
					date: d.date,
					reportWorkTime: d.reportWorkTime,
					reportNightWorkTime: d.reportNightWorkTime,
					dayMarkCode: d.dayMarkCode,
					extraMarkCode: d.extraMarkCode?.trim() || null,
					extraMarkMinutes: d.extraMarkMinutes
				}));

			const res = await fetch('/apps/tabel/tabel/employee-events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ employeeId, year, month, days: body })
			});

			if (!res.ok) {
				const j = await res.json().catch(() => null);
				throw new Error(j?.message ?? 'Failed to save');
			}
			const result = await res.json();
			const updated = result?.data?.updated ?? result?.updated;

			if (updated?.length && onSave) {
				onSave(updated);
			}
			toast.success('Сохранено');
		} catch (e) {
			console.error('[WTT] save events error', e);
			toast.error('Не удалось сохранить события');
		} finally {
			saving = false;
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
</script>

{#snippet dayCell(_value: any, row: DayRow)}
	<div class="flex h-7 w-full items-center justify-center text-xs">
		{row.dayNum}
		{#if row.dayData?.reportWorkTime != null || row.dayData?.reportNightWorkTime != null}*{/if}
	</div>
{/snippet}

{#snippet hoursCell(_value: any, row: DayRow)}
	{#if readonly}
		<div class="flex h-7 w-full items-center justify-center text-xs">
			{hoursText(row.dayData)}
		</div>
	{:else}
		<Input
			type="number"
			step="0.1"
			class="h-7 w-full rounded-none text-center text-xs"
			value={fmt(row.dayData?.reportWorkTime ?? row.dayData?.shiftWorkTime ?? null)}
			oninput={(e) => {
				row.dayData.reportWorkTime = parseHours((e.target as HTMLInputElement).value);
			}}
		/>
	{/if}
{/snippet}

{#snippet nightCell(_value: any, row: DayRow)}
	{#if readonly}
		<div class="flex h-7 w-full items-center justify-center text-xs">
			{nightText(row.dayData)}
		</div>
	{:else}
		<Input
			type="number"
			step="0.1"
			class="h-7 w-full rounded-none text-center text-xs"
			value={fmt(row.dayData?.reportNightWorkTime ?? row.dayData?.shiftNightWorkTime ?? null)}
			oninput={(e) => {
				row.dayData.reportNightWorkTime = parseHours((e.target as HTMLInputElement).value);
			}}
		/>
	{/if}
{/snippet}

{#snippet markCell(_value: any, row: DayRow)}
	{@const cellStyle = getCellStyle(row.dayData)}
	{#if readonly}
		<div class="flex h-7 w-full items-center justify-center text-xs uppercase" style={cellStyle}>
			{row.dayData?.dayMarkCode ?? ''}
		</div>
	{:else}
		<Input
			class="m-0 h-7 w-full rounded-none p-0 text-center text-xs uppercase"
			style={cellStyle}
			value={row.dayData?.dayMarkCode ?? ''}
			oninput={(e) => {
				row.dayData.dayMarkCode = (e.target as HTMLInputElement).value.toUpperCase();
			}}
		/>
	{/if}
{/snippet}

{#snippet extraMarkCell(_value: any, row: DayRow)}
	{#if readonly}
		<div
			class="flex h-7 w-full items-center justify-center text-xs text-muted-foreground uppercase italic"
		>
			{row.dayData?.extraMarkCode ?? ''}
		</div>
	{:else}
		<Input
			class="m-0 h-7 w-full rounded-none p-0 text-center text-xs text-muted-foreground uppercase italic"
			value={row.dayData?.extraMarkCode ?? ''}
			placeholder="—"
			oninput={(e) => {
				row.dayData.extraMarkCode = (e.target as HTMLInputElement).value.toUpperCase() || null;
			}}
		/>
	{/if}
{/snippet}

{#snippet extraHoursCell(_value: any, row: DayRow)}
	{#if readonly}
		<div class="flex h-7 w-full items-center justify-center text-xs text-muted-foreground italic">
			{fmt(row.dayData?.extraMarkMinutes ?? null)}
		</div>
	{:else}
		<Input
			type="number"
			step="0.1"
			class="h-7 w-full rounded-none text-center text-xs text-muted-foreground italic"
			value={fmt(row.dayData?.extraMarkMinutes ?? null)}
			placeholder="ч"
			oninput={(e) => {
				row.dayData.extraMarkMinutes = parseHours((e.target as HTMLInputElement).value);
			}}
		/>
	{/if}
{/snippet}

<Dialog
	{open}
	onOpenChange={(v) => {
		open = v;
		show = v;
	}}
>
	<DialogContent
		class="flex max-h-[calc(100dvh-2em)] flex-col overflow-hidden"
		style="width: min(1100px, calc(100vw - 2rem)); max-width: min(1100px, calc(100vw - 2rem))"
	>
		<DialogHeader>
			<DialogTitle class="space-y-1">
				<p>
					События сотрудника:
					{employee?.lastName}
					{employee?.firstName}
					{employee?.middleName ?? ''}
				</p>
			</DialogTitle>
		</DialogHeader>

		<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
			{#if loading}
				<div class="flex items-center justify-center text-sm text-muted-foreground">
					Загрузка...
				</div>
			{:else}
				<div class="shrink-0">
					<div class="space-y-1 text-sm">
						<p><span class="font-medium">Табельный номер:</span> {employee?.number}</p>
						<p><span class="font-medium">Должность:</span> {positionName || '—'}</p>
						<p><span class="font-medium">Подразделение:</span> {departmentName || '—'}</p>
					</div>
					<Separator class="my-2" />
					<div>
						Данные за:
						{months[month - 1]}
						{year}
					</div>
				</div>

				<!-- Горизонтально: события турникета | метки -->
				<div class="flex min-h-0 flex-1 gap-3 overflow-hidden">
					<!-- События турникета (read-only) -->
					<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
						<p class="text-sm font-medium">События турникета</p>
						{#if turnstileEvents.length === 0}
							<div
								class="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground"
							>
								Нет событий турникета за этот месяц
							</div>
						{:else}
							<div class="min-h-0 flex-1 overflow-hidden rounded-xl border">
								<div class="h-full overflow-auto">
									<ETable
										data={turnstileEvents}
										getRowId={(e, i) => i}
										columns={[
											{
												key: 'datetime',
												label: 'Дата и время',
												width: 160,
												cellClass: 'px-1 py-1.5 font-mono',
												format: (v) =>
													new Date(v).toLocaleString('ru-RU', {
														day: '2-digit',
														month: '2-digit',
														year: 'numeric',
														hour: '2-digit',
														minute: '2-digit'
													})
											},
											{
												key: 'eventName',
												label: 'Событие',
												width: 200,
												cellClass: 'px-1 py-1.5'
											},
											{
												key: 'passNumber',
												label: 'Пропуск',
												width: 100,
												cellClass: 'px-1 py-1.5',
												format: (v, row) => {
													const r = row as {
														passSeria?: string | null;
														passNumber: string;
													};
													return r.passSeria ? `${r.passSeria} ${r.passNumber}` : r.passNumber;
												}
											}
										]}
									/>
								</div>
							</div>
						{/if}
					</div>

					<!-- Метки по дням (редактируемые) -->
					<div class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
						<p class="text-sm font-medium">Метки по дням</p>
						<div class="min-h-0 flex-1 overflow-hidden rounded-xl border-2">
							<div class="h-full overflow-auto">
								<ETable
									data={rows}
									getRowId={(r) => r.id}
									columns={[
										{
											key: 'dayNum',
											label: 'День',
											width: 45,
											align: 'center' as const,
											render: dayCell
										},
										{
											key: ['dayData', 'reportWorkTime'],
											label: 'Часов',
											width: 60,
											align: 'center' as const,
											render: hoursCell
										},
										{
											key: ['dayData', 'reportNightWorkTime'],
											label: 'Ночных',
											width: 60,
											align: 'center' as const,
											render: nightCell
										},
										{
											key: ['dayData', 'dayMarkCode'],
											label: 'Метка',
											width: 55,
											align: 'center' as const,
											render: markCell
										},
										{
											key: ['dayData', 'extraMarkCode'],
											label: 'Доп.метка',
											width: 55,
											align: 'center' as const,
											render: extraMarkCell
										},
										{
											key: ['dayData', 'extraMarkMinutes'],
											label: 'Час.доп',
											width: 55,
											align: 'center' as const,
											render: extraHoursCell
										}
									]}
								/>
							</div>
						</div>
					</div>
				</div>

				<div class="flex shrink-0 justify-end gap-2">
					<Button variant="outline" onclick={() => (show = false)} disabled={saving}>
						{readonly ? 'Закрыть' : 'Отмена'}
					</Button>
					{#if !readonly}
						<Button onclick={save} disabled={saving}>
							{saving ? 'Сохранение...' : 'Сохранить'}
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
