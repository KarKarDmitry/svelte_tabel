<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Grid2x2Check } from '@lucide/svelte';
	import type { EColumn } from '$lib/components/ETable/types';

	type DayMarkValue = {
		value: string;
		date: string;
		reportWorkTime: number | null;
		shiftWorkTime: number | null;
		dayMarkCode: string;
		blocked?: boolean;
		missingMinutes?: number;
		extraMarkCode?: string | null;
		extraMarkMinutes?: number | null;
	};

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

	let {
		dept,
		columns,
		dayMarks,
		calendarDays,
		schedulesById,
		showActual,
		canEditDivision = false,
		onRequestBulkAssign,
		onOpenEmployee
	}: {
		dept: any;
		columns: EColumn<TabelRow>[];
		dayMarks: any[];
		calendarDays: Record<string, { dayType: string; workTime: number | null }>;
		schedulesById: Record<number, { standardWorkTime: number; weekDays: string | null }>;
		showActual: boolean;
		canEditDivision?: boolean;
		onRequestBulkAssign?: (dept: any) => void;
		onOpenEmployee: (empId: number) => void;
	} = $props();

	let open = $state(false);
	let built = $state(false);
	let rows = $state<TabelRow[]>([]);

	function formatHours(minutes: number | null): string {
		if (minutes == null) return '';
		return (minutes / 60).toFixed(1);
	}

	function getDayMark(value: string): string {
		if (!value) return '';
		const mark = dayMarks.find((m: any) => m.shortName === value || m.code === value);
		return mark?.shortName ?? value;
	}

	function buildRows(emp: any): TabelRow[] {
		const segKey = `${emp.segmentFrom || ''}-${emp.departmentId || 0}`;

		let totalReport = 0;
		let totalNight = 0;

		const hoursRow: TabelRow = {
			id: `${emp.id}-${segKey}-hours`,
			type: 'hours',
			empId: emp.id,
			number: emp.number,
			lastName: emp.lastName,
			firstName: emp.firstName,
			totalReport: 0,
			totalNight: 0
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
			// Отчётные часы приоритетны; пока табельщик их не проставил — берём сменные из импорта
			const workMinutes = day.reportWorkTime ?? day.shiftWorkTime;
			const dayStdMin =
				day.scheduleId && schedulesById[day.scheduleId]
					? schedulesById[day.scheduleId].standardWorkTime
					: workMinutes && !day.scheduleId
						? (Object.values(schedulesById).find((s) => s.standardWorkTime === workMinutes)
								?.standardWorkTime ?? null)
						: null;
			const stdMin = calDayForDate?.workTime ?? dayStdMin ?? emp.schedule?.standardWorkTime;

			const workTime = showActual ? day.rawWorkTime : workMinutes;
			const nightTime = showActual
				? day.rawNightWorkTime
				: (day.reportNightWorkTime ?? day.shiftNightWorkTime);
			const hasShortage = workMinutes != null && stdMin != null && workMinutes < stdMin;

			// Звёздочка — день с отчётными значениями (проставлен табельщиком)
			const hasReport = day.reportWorkTime != null || day.reportNightWorkTime != null;
			hoursRow[`day_${index + 1}`] = formatHours(workTime) + (hasReport && !showActual ? '*' : '');
			hoursRow[`day_${index + 1}_blocked`] = day.blocked ?? false;
			totalReport += workTime ?? 0;
			totalNight += nightTime ?? 0;

			// В режиме «Фактическое время» показываем метку факта импорта, иначе — эффективную
			const displayMark = showActual ? (day.factMarkCode ?? '') : day.dayMarkCode;

			markRow[`day_${index + 1}`] = {
				value: getDayMark(displayMark),
				date: day.date,
				reportWorkTime: day.reportWorkTime,
				shiftWorkTime: day.shiftWorkTime,
				dayMarkCode: displayMark,
				blocked: day.blocked ?? false,
				missingMinutes: hasShortage ? stdMin - workMinutes : 0,
				extraMarkCode: day.extraMarkCode ?? null,
				extraMarkMinutes: day.extraMarkMinutes ?? null
			} satisfies DayMarkValue;
		}
		hoursRow.totalReport = totalReport;
		hoursRow.totalNight = totalNight;
		return [hoursRow, markRow];
	}

	// Строим строки только при первом открытии; даём кадр на скелетон
	$effect(() => {
		if (open && !built) {
			const t = setTimeout(() => {
				rows = dept.employees.flatMap(buildRows);
				built = true;
			}, 120);
			return () => clearTimeout(t);
		}
	});

	// Пересчёт при изменении режима (showActual), если карточка уже построена
	$effect(() => {
		if (open && built) {
			rows = dept.employees.flatMap(buildRows);
		}
	});

	// --- Обычная таблица (вместо ETable) ---

	function getValue(row: TabelRow, key: keyof TabelRow | string[]) {
		if (Array.isArray(key)) {
			let val: any = row;
			for (const k of key) {
				if (val == null) return null;
				val = val[k];
			}
			return val;
		}
		return row[key as keyof TabelRow];
	}

	function colKey(col: EColumn<TabelRow>) {
		return Array.isArray(col.key) ? col.key.join('.') : String(col.key);
	}

	function alignClass(align?: 'left' | 'center' | 'right') {
		switch (align) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			default:
				return 'text-left';
		}
	}

	// Смещения липких колонок (left) — как в ETable
	const stickyOffsets = $derived.by(() => {
		let offset = 0;
		return columns.map((col) => {
			if (!col.sticky) return null;
			const current = offset;
			offset += col.width ?? 160;
			return current;
		});
	});

	function colStyle(col: EColumn<TabelRow>, off: number | null): string {
		const parts: string[] = [];
		if (col.width) {
			parts.push(`width:${col.width}px`, `min-width:${col.width}px`, `max-width:${col.width}px`);
		}
		if (col.sticky && off != null) parts.push(`left:${off}px`);
		return parts.join(';');
	}

	function cn(...classes: Array<string | false | null | undefined>) {
		return classes.filter(Boolean).join(' ');
	}
</script>

<Collapsible class="overflow-hidden rounded-xl border bg-card" bind:open>
	<CollapsibleTrigger
		class="grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-3 text-sm transition-colors hover:bg-muted/40"
	>
		<span class="py-2 text-left font-medium whitespace-nowrap">{dept.name}</span>
		<!-- Средняя колонка — самая большая, сюда можно размещать команды/действия -->
		<div class="space-x-3 border-x-2">
			{#if canEditDivision}
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							variant="ghost"
							class=""
							size="sm"
							onclick={(e) => {
								e.stopPropagation();
								onRequestBulkAssign?.(dept);
							}}
						>
							<Grid2x2Check size={30} />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content>Быстрое назначение</Tooltip.Content>
				</Tooltip.Root>
			{/if}
		</div>
		<Badge class="py-2 text-xs ">{dept.employees.length}</Badge>
	</CollapsibleTrigger>

	<CollapsibleContent class="border-t">
		{#if open && !built}
			<div class="flex flex-col gap-1 p-2">
				<Skeleton class="h-8 w-full" />
				<Skeleton class="h-8 w-full" />
				<Skeleton class="h-8 w-full" />
				<Skeleton class="h-8 w-full" />
			</div>
		{:else if built}
			<div class="min-h-0 overflow-auto bg-background">
				<table class="w-full table-fixed border-collapse text-[13px]">
					<thead
						class="sticky top-0 z-30 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
					>
						<tr class="border-b">
							{#each columns as col, ci (colKey(col))}
								{@const off = stickyOffsets[ci]}
								<th
									class={cn(
										'relative h-10 border-r px-3 text-xs font-semibold whitespace-nowrap',
										alignClass(col.align),
										col.headClass,
										col.sticky &&
											'sticky z-30 bg-background supports-backdrop-filter:bg-background/95'
									)}
									style={colStyle(col, off)}
								>
									<div class="truncate">{col.label}</div>
									{#if col.sticky}
										<div class="absolute top-0 right-0 h-full w-px bg-border"></div>
									{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.id)}
							<tr
								class={cn(
									'border-b transition-colors',
									row.type === 'hours'
										? 'cursor-pointer hover:bg-muted/20'
										: 'bg-muted/10 text-[11px]'
								)}
								onclick={row.type === 'hours' ? () => onOpenEmployee(row.empId) : undefined}
							>
								{#each columns as col, ci (colKey(col))}
									{@const off = stickyOffsets[ci]}
									{@const value = getValue(row, col.key)}
									<td
										class={cn(
											'relative border-r p-0 leading-normal whitespace-nowrap',
											alignClass(col.align),
											col.mono && 'font-mono tabular-nums',
											col.cellClass,
											col.sticky && 'sticky z-20 bg-background'
										)}
										style={colStyle(col, off)}
									>
										{#if typeof col.render === 'function'}
											{@render col.render(value, row, col)}
										{:else}
											<div class="truncate">
												{col.format ? col.format(value, row) : (value ?? '—')}
											</div>
										{/if}
										{#if col.sticky}
											<div class="absolute top-0 right-0 h-full w-px bg-border"></div>
										{/if}
									</td>
								{/each}
							</tr>
						{:else}
							<tr>
								<td colspan={columns.length} class="h-32 text-center text-sm text-muted-foreground">
									Нет данных
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</CollapsibleContent>
</Collapsible>
