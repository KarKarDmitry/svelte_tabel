<script lang="ts">
	import { page } from '$app/stores';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';

	let events = $derived($page.data.events);
	let eventTypes = $derived($page.data.eventTypes);
</script>

<Card>
	<CardHeader><CardTitle>События за {$page.data.month}/{$page.data.year}</CardTitle></CardHeader>
	<CardContent class="p-0">
		{#if events.length === 0}
			<p class="p-4 text-center text-sm text-gray-400">Нет событий</p>
		{:else}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Дата и время</TableHead>
						<TableHead>Событие</TableHead>
						<TableHead>Пропуск</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each events as e}
						<TableRow>
							<TableCell>{new Date(e.datetime).toLocaleString()}</TableCell>
							<TableCell>{eventTypes.find((t: any) => t.id === e.eventId)?.name ?? '—'}</TableCell>
							<TableCell class="font-mono text-sm">{e.passId}</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		{/if}
	</CardContent>
</Card>
