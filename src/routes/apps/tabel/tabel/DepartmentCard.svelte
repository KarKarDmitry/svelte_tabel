<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ETable from '$lib/components/ETable/ETable.svelte';
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
		onOpenEmployee
	}: {
		dept: any;
		columns: EColumn<TabelRow>[];
		dayMarks: any[];
		calendarDays: Record<string, { dayType: string; workTime: number | null }>;
		schedulesById: Record<number, { standardWorkTime: number; weekDays: string | null }>;
		showActual: boolean;
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

			hoursRow[`day_${index + 1}`] = formatHours(workTime);
			hoursRow[`day_${index + 1}_blocked`] = day.blocked ?? false;
			totalReport += workTime ?? 0;
			totalNight += nightTime ?? 0;

			markRow[`day_${index + 1}`] = {
				value: getDayMark(day.dayMarkCode),
				date: day.date,
				reportWorkTime: day.reportWorkTime,
				shiftWorkTime: day.shiftWorkTime,
				dayMarkCode: day.dayMarkCode,
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
</script>

<Collapsible class="overflow-hidden rounded-xl border bg-card" bind:open>
	<CollapsibleTrigger
		class="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
	>
		<span class="font-medium">{dept.name}</span>
		<Badge class="text-xs">{dept.employees.length}</Badge>
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
			<div class="overflow-x-auto">
				<ETable
					data={rows}
					{columns}
					getRowId={(row) => row.id}
					rowClass={(row) =>
						row.type === 'mark' ? 'bg-muted/10 text-[11px]' : 'hover:bg-muted/20'}
					onRowClick={(row) => {
						if (row.type === 'hours') onOpenEmployee(row.empId);
					}}
				/>
			</div>
		{/if}
	</CollapsibleContent>
</Collapsible>
