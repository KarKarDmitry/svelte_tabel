<script lang="ts">
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger
	} from '$lib/components/ui/collapsible';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cellStyle } from '$lib/apps/tabel/cell-style';

	let {
		day,
		cellColorRules,
		markColorRules,
		shiftMarks,
		empSchedule,
		dayMarks
	}: {
		day: any;
		cellColorRules: Record<string, any>;
		markColorRules: Record<string, any>;
		shiftMarks: string[];
		empSchedule: any;
		dayMarks: any[];
	} = $props();

	function fmt(min: number | null): string {
		if (min == null) return '';
		return (min / 60).toFixed(1);
	}

	function getCellStyle(): string {
		return cellStyle(day, empSchedule, {
			shiftMarks,
			calendarDays: day.calendarDay ? { [day.date]: day.calendarDay } : {},
			schedulesById: {},
			cellColorRules,
			markColorRules
		});
	}

	const dayNum = $derived(Number(day.date.slice(8, 10)));
	const weekday = $derived(new Date(day.date).toLocaleDateString('ru-RU', { weekday: 'short' }));
	const typeLabel = $derived(
		day.calendarDay?.dayType === 'holiday'
			? 'праздник'
			: day.calendarDay?.dayType === 'weekend'
				? 'выходной'
				: day.calendarDay?.dayType === 'preholiday'
					? 'предпраздн.'
					: day.calendarDay?.dayType === 'transferred_workday'
						? 'перенос'
						: ''
	);
	const hasDetails = $derived(
		day.events.length > 0 || day.extraMarkCode || day.reportNightWorkTime != null
	);
</script>

<Collapsible class="overflow-hidden rounded-xl border bg-background" style={getCellStyle()} open>
	<CollapsibleTrigger class="flex w-full flex-col items-start gap-1 px-3 py-2 text-left">
		<div class="flex w-full items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="text-sm font-semibold">{dayNum}</span>
				<span class="text-xs text-muted-foreground">{weekday}</span>
				{#if typeLabel}
					<span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
						{typeLabel}
					</span>
				{/if}
			</div>
			{#if hasDetails}
				<ChevronDownIcon class="size-3.5 text-muted-foreground" />
			{/if}
		</div>

		<div class="flex w-full items-center justify-between gap-2">
			<span class="rounded-md px-1.5 py-0.5 text-sm font-medium">
				{day.dayMarkCode || '—'}
			</span>
			<div class="text-right">
				<div class="text-sm font-medium tabular-nums">
					{fmt(day.reportWorkTime ?? day.shiftWorkTime)}
					{#if day.reportNightWorkTime != null}
						<span class="text-xs text-muted-foreground">
							+ {fmt(day.reportNightWorkTime)} н
						</span>
					{/if}
				</div>
			</div>
		</div>
	</CollapsibleTrigger>

	<CollapsibleContent class="border-t">
		{#if hasDetails}
			<div class="flex flex-col gap-2 px-3 py-2 text-xs">
				<!-- Доп. метка -->
				{#if day.extraMarkCode}
					<div class="flex items-center gap-2">
						<span class="text-muted-foreground">Доп. метка:</span>
						<span class="font-medium uppercase">{day.extraMarkCode}</span>
						{#if day.extraMarkMinutes != null}
							<span class="text-muted-foreground">
								({fmt(day.extraMarkMinutes)} ч)
							</span>
						{/if}
					</div>
				{/if}

				<!-- Часы по типам -->
				{#if day.rawWorkTime != null || day.shiftWorkTime != null}
					<div class="flex flex-col gap-0.5 text-muted-foreground">
						{#if day.rawWorkTime != null}
							<div class="flex justify-between">
								<span>Фактически</span>
								<span class="tabular-nums">{fmt(day.rawWorkTime)} ч</span>
							</div>
						{/if}
						{#if day.shiftWorkTime != null}
							<div class="flex justify-between">
								<span>По графику</span>
								<span class="tabular-nums">{fmt(day.shiftWorkTime)} ч</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- События турникета -->
				{#if day.events.length > 0}
					<div class="flex flex-col gap-1">
						<span class="text-muted-foreground">События турникета ({day.events.length}):</span>
						{#each day.events as e}
							<div class="flex items-center justify-between rounded-md bg-card px-2 py-1">
								<span class="tabular-nums">
									{new Date(e.datetime).toLocaleTimeString('ru-RU', {
										hour: '2-digit',
										minute: '2-digit'
									})}
								</span>
								<span class="w-full px-3 text-left whitespace-nowrap">{e.eventName}</span>
								<span class="whitespace-nowrap text-muted-foreground">
									{e.passSeria ? `${e.passSeria} ` : ''}{e.passNumber ?? `#${e.passId}`}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="px-3 py-2 text-xs text-muted-foreground">Нет дополнительных данных</div>
		{/if}
	</CollapsibleContent>
</Collapsible>
