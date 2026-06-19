<script lang="ts">
	import { page } from '$app/stores';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';

	let records = $derived($page.data.worktimeRecords);
	let dayMarks = $derived($page.data.dayMarks);

	const totalMinutes = $derived(
		records.reduce((sum: number, r: any) => sum + (r.reportWorkTime ?? r.shiftWorkTime ?? 0), 0)
	);
</script>

<Card>
	<CardHeader><CardTitle>Рабочее время за {$page.data.month}/{$page.data.year}</CardTitle></CardHeader>
	<CardContent class="p-0">
		{#if records.length === 0}
			<p class="p-4 text-center text-sm text-gray-400">Нет записей</p>
		{:else}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Дата</TableHead>
						<TableHead>Часов</TableHead>
						<TableHead>Ночных</TableHead>
						<TableHead>Метка</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each records as r}
						<TableRow>
							<TableCell>{r.date}</TableCell>
							<TableCell>{r.reportWorkTime ?? r.shiftWorkTime ?? 0} мин</TableCell>
							<TableCell>{r.reportNightWorkTime ?? r.shiftNightWorkTime ?? 0} мин</TableCell>
							<TableCell>
								{r.dayMarkCode
									? (dayMarks.find((m: any) => m.code === r.dayMarkCode)?.shortName ?? r.dayMarkCode)
									: '—'}
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
			<div class="border-t p-4 text-sm font-medium">
				Всего отработано: {totalMinutes} мин ({Math.round(totalMinutes / 60)} ч)
			</div>
		{/if}
	</CardContent>
</Card>
