<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { mode } from 'mode-watcher';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import MonthYearPicker from '$lib/components/DatetimePick/MonthYearPicker.svelte';
	import DayCard from './DayCard.svelte';

	let days = $derived($page.data.days);
	let isDark = $derived(mode.current === 'dark');
	// Сервер отдаёт { light, dark } — выбираем набор по текущей теме
	let cellColorRules = $derived(($page.data.cellColorRules ?? {})[isDark ? 'dark' : 'light'] ?? {});
	let markColorRules = $derived(($page.data.markColorRules ?? {})[isDark ? 'dark' : 'light'] ?? {});
	let shiftMarks = $derived($page.data.shiftMarks);
	let empSchedule = $derived($page.data.empSchedule);
	let dayMarks = $derived($page.data.dayMarks);
	let year = $derived($page.data.year);
	let month = $derived($page.data.month);

	function changePeriod(y: number, m: number) {
		goto(`/apps/tabel/employees/${$page.params.id}/worktime?year=${y}&month=${m}`, {
			invalidateAll: true
		});
	}

	const totalMinutes = $derived(
		days.reduce((sum: number, d: any) => sum + (d.reportWorkTime ?? d.shiftWorkTime ?? 0), 0)
	);
	const totalNight = $derived(
		days.reduce((sum: number, d: any) => sum + (d.reportNightWorkTime ?? 0), 0)
	);
</script>

<Card>
	<CardHeader>
		<div class="flex items-center justify-between">
			<CardTitle>
				Рабочее время за
				<MonthYearPicker {year} {month} onChange={changePeriod} />
			</CardTitle>
		</div>
	</CardHeader>
	<CardContent>
		{#if days.length === 0}
			<p class="p-4 text-center text-sm text-muted-foreground">Нет записей</p>
		{:else}
			<div
				class="grid grid-cols-2 gap-2 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
			>
				{#each days as d}
					<DayCard
						day={d}
						{cellColorRules}
						{markColorRules}
						{shiftMarks}
						{empSchedule}
						{dayMarks}
					/>
				{/each}
			</div>
			<div class="mt-4 flex flex-wrap gap-4 border-t pt-3 text-sm">
				<div class="font-medium">
					Всего отработано: {Math.round(totalMinutes / 60)} ч
				</div>
				{#if totalNight > 0}
					<div class="text-muted-foreground">
						из них ночных: {Math.round(totalNight / 60)} ч
					</div>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
