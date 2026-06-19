<script lang="ts">
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import ETable from '$lib/components/ETable/ETable.svelte';

	let {
		show = $bindable(false),
		employeeId,
		year,
		month,
		departmentName = '',
		positionName = '',
		onSave
	}: {
		show: boolean;
		employeeId: number | null;
		year: number;
		month: number;
		departmentName?: string;
		positionName?: string;
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

	let loading = $state(false);
	let saving = $state(false);
	let employee: any = $state(null);
	let days = $state<
		Array<{
			date: string;
			reportWorkTime: number | null;
			reportNightWorkTime: number | null;
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
		const hasHours = day.reportWorkTime != null;
		const expectedMinutes = calDay?.workTime ?? empSchedule?.standardWorkTime;

		// Сменная отметка без часов
		if (isShift && !hasHours && cellColorRules.missingHours?.bg) {
			style.push(`background-color:${cellColorRules.missingHours.bg}`);
			return style.join(';');
		}

		// Переработка / недоработка (с допуском 3 мин)
		if (isShift && hasHours && expectedMinutes) {
			const diff = Math.abs(day.reportWorkTime - expectedMinutes);
			if (diff > 3) {
				if (day.reportWorkTime > expectedMinutes && cellColorRules.overwork?.bg) {
					style.push(`background-color:${cellColorRules.overwork.bg}`);
					return style.join(';');
				}
				if (day.reportWorkTime < expectedMinutes && cellColorRules.underwork?.bg) {
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
		if (!show || !employeeId) return;
		loadData();
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
			cellColorRules = data.cellColorRules ?? {};
			markColorRules = data.markColorRules ?? {};
			calendarDays = data.calendarDays ?? {};
			empSchedule = data.empSchedule ?? null;
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

			if (!res.ok) throw new Error('Failed to save');
			const result = await res.json();
			const updated = result?.data?.updated ?? result?.updated;

			if (updated?.length && onSave) {
				onSave(updated);
			}
		} catch (e) {
			console.error('[WTT] save events error', e);
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

{#snippet hoursCell(_value: any, row: DayRow)}
	<Input
		type="number"
		step="0.1"
		class="h-7 w-full rounded-none text-center text-xs"
		value={fmt(row.dayData?.reportWorkTime ?? null)}
		oninput={(e) => {
			row.dayData.reportWorkTime = parseHours((e.target as HTMLInputElement).value);
		}}
	/>
{/snippet}

{#snippet nightCell(_value: any, row: DayRow)}
	<Input
		type="number"
		step="0.1"
		class="h-7 w-full rounded-none text-center text-xs"
		value={fmt(row.dayData?.reportNightWorkTime ?? null)}
		oninput={(e) => {
			row.dayData.reportNightWorkTime = parseHours((e.target as HTMLInputElement).value);
		}}
	/>
{/snippet}

{#snippet markCell(_value: any, row: DayRow)}
	{@const cellStyle = getCellStyle(row.dayData)}
	<Input
		class="m-0 h-7 w-full rounded-none p-0 text-center text-xs uppercase"
		style={cellStyle}
		value={row.dayData?.dayMarkCode ?? ''}
		oninput={(e) => {
			row.dayData.dayMarkCode = (e.target as HTMLInputElement).value.toUpperCase();
		}}
	/>
{/snippet}

{#snippet extraMarkCell(_value: any, row: DayRow)}
	<Input
		class="m-0 h-7 w-full rounded-none p-0 text-center text-xs text-muted-foreground uppercase italic"
		value={row.dayData?.extraMarkCode ?? ''}
		placeholder="—"
		oninput={(e) => {
			row.dayData.extraMarkCode = (e.target as HTMLInputElement).value.toUpperCase() || null;
		}}
	/>
{/snippet}

{#snippet extraHoursCell(_value: any, row: DayRow)}
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
{/snippet}

<Dialog bind:open={show}>
	<DialogContent class="flex max-h-[calc(100dvh-2em)] w-full max-w-[calc(100dvw-2em)] flex-col">
		<DialogHeader>
			<DialogTitle class="space-y-1">
				<p>События сотрудника:</p>
				<p>
					{employee?.lastName}
					{employee?.firstName}
					{employee?.middleName ?? ''}
				</p>
			</DialogTitle>
		</DialogHeader>

		<div class="flex flex-col gap-2 overflow-hidden">
			{#if loading}
				<div class="flex items-center justify-center text-sm text-muted-foreground">
					Загрузка...
				</div>
			{:else}
				<div class="flex flex-wrap gap-2 overflow-hidden">
					<div class="shrink-0">
						<div class="space-y-1 text-sm">
							<p><span class="font-medium">Табельный номер:</span> {employee?.number}</p>
							<p><span class="font-medium">Должность:</span> {positionName || '—'}</p>
							<p><span class="font-medium">Подразделение:</span> {departmentName || '—'}</p>
						</div>
						<div class="text-xs text-muted-foreground">
							{months[month - 1]}
							{year}
						</div>
					</div>

					<div class="flex max-h-150 overflow-hidden rounded-xl border-2">
						<ETable
							data={rows}
							getRowId={(r) => r.id}
							columns={[
								{ key: 'dayNum', label: 'День', width: 45, align: 'center' as const },
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

				<div class="flex justify-end gap-2">
					<Button variant="outline" onclick={() => (show = false)} disabled={saving}>Отмена</Button>
					<Button onclick={save} disabled={saving}>
						{saving ? 'Сохранение...' : 'Сохранить'}
					</Button>
				</div>
			{/if}
		</div>
	</DialogContent>
</Dialog>
