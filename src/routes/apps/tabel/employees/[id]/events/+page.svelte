<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import MonthYearPicker from '$lib/components/MonthYearPicker.svelte';

	let events = $derived($page.data.events);
	let year = $derived($page.data.year);
	let month = $derived($page.data.month);

	function changePeriod(y: number, m: number) {
		goto(`/apps/tabel/employees/${$page.params.id}/events?year=${y}&month=${m}`, {
			invalidateAll: true
		});
	}

	const columns = [
		{
			key: 'datetime',
			mono: true,
			label: 'Дата и время',
			format: (v: string) =>
				new Date(v).toLocaleString('ru-RU', {
					day: '2-digit',
					month: '2-digit',
					year: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})
		},
		{ key: 'eventName', label: 'Событие' },
		{
			key: 'passNumber',
			label: 'Пропуск',
			format: (v: string, row: any) =>
				row.passSeria ? `${row.passSeria} ${row.passNumber}` : (row.passNumber ?? `#${row.passId}`)
		}
	];
</script>

<Card class="gap-0 ">
	<CardHeader>
		<div class="flex items-center justify-between">
			<CardTitle>
				События за
				<MonthYearPicker {year} {month} onChange={changePeriod} />
			</CardTitle>
		</div>
	</CardHeader>
	<CardContent class="p-0 pt-2">
		<Separator />
		{#if events.length === 0}
			<p class="p-4 text-center text-sm text-gray-400">Нет событий</p>
		{:else}
			<DTable data={events} {columns} variant="ghost" />
		{/if}
	</CardContent>
</Card>
