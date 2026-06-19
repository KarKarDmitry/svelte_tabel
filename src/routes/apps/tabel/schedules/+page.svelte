<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent, DialogHeader } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

	let fetched = $state<{ schedules?: any[] }>({});
	let schedules = $derived(fetched.schedules ?? data.schedules);
	let searchVal = $state(page.url.searchParams.get('search') || '');

	let createOpen = $state(false);
	let weekDays = $state<number[]>([1, 2, 3, 4, 5]);
	let hoursTime = $state('08:00');

	function toggleDay(day: number) {
		const idx = weekDays.indexOf(day);
		if (idx >= 0) weekDays = weekDays.filter((d) => d !== day);
		else weekDays = [...weekDays, day].sort();
	}

	function parseWeekDays(v: string | null): number[] {
		if (!v) return [];
		try {
			return JSON.parse(v);
		} catch {
			return [];
		}
	}

	function formatWorkTime(minutes: number): string {
		return `${Math.floor(minutes / 60)}ч`;
	}

	async function onSearch(value: string) {
		const url = new URL(page.url);
		url.searchParams.set('search', value);
		const res = await fetch(url);
		if (res.ok) {
			const j = await res.json();
			fetched = { schedules: j.schedules };
			replaceState(url.pathname + url.search, {});
		}
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Графики работы</h1>
		<Button
			onclick={() => {
				weekDays = [1, 2, 3, 4, 5];
				hoursTime = '08:00';
				createOpen = true;
			}}
		>
			Добавить график
		</Button>
	</div>

	{#snippet renderCell(value: any, row: any, col: any)}
		{#if col.key === 'standardWorkTime'}
			{formatWorkTime(value)}
		{:else if col.key === 'weekDays'}
			<div class="flex flex-wrap gap-1">
				{#each parseWeekDays(value) as d}
					<Badge class="text-xs">{dayNames[d - 1]}</Badge>
				{/each}
				{#if !value}
					<span class="text-gray-400">—</span>
				{/if}
			</div>
		{:else if col.format}
			{col.format(value, row)}
		{:else}
			{value ?? '—'}
		{/if}
	{/snippet}

	<DTable
		data={schedules}
		columns={[
			{ key: 'name', label: 'Название' },
			{ key: 'standardWorkTime', label: 'Норма' },
			{ key: 'weekDays', label: 'Рабочие дни' }
		]}
		cell={renderCell}
		filters={[
			{
				key: 'search',
				placeholder: 'Поиск по названию...',
				type: 'string',
				value: searchVal,
				onSearch: (v) => {
					searchVal = v;
					onSearch(v);
				}
			}
		]}
		rowActions={[{ label: 'Открыть', onclick: (row) => goto(`/apps/tabel/schedules/${row.id}`) }]}
		onRowClick={(row) => goto(`/apps/tabel/schedules/${row.id}`)}
	/>

	<!-- Диалог создания -->
	<Dialog bind:open={createOpen}>
		<DialogContent>
			<DialogHeader>
				<p class="font-bold">Новый график</p>
			</DialogHeader>
			<form method="post" action="?/create" class="flex flex-col gap-4" use:enhance>
				<input type="hidden" name="weekDays" value={weekDays.join(',')} />

				<div class="flex flex-col gap-1">
					<label for="name" class="text-sm font-medium">Название</label>
					<Input id="name" name="name" placeholder="Например: Стандартный 8:00–17:00" required />
				</div>

				<div class="flex flex-col gap-1">
					<label for="hours" class="text-sm font-medium">Норма (часов в день)</label>
					<Input
						id="hours"
						name="hours"
						type="time"
						value={hoursTime}
						oninput={(e) => (hoursTime = (e.target as HTMLInputElement).value)}
						required
					/>
				</div>

				<div class="flex flex-col gap-1">
					<label class="text-sm font-medium"
						>Рабочие дни
						<div class="flex flex-wrap gap-2">
							{#each dayNames as name, i}
								<Button
									type="button"
									variant={weekDays.includes(i + 1) ? 'default' : 'outline'}
									size="sm"
									onclick={() => toggleDay(i + 1)}
								>
									{name}
								</Button>
							{/each}
						</div>
					</label>
				</div>

				<Button type="submit">Создать и перейти к точкам</Button>
			</form>
		</DialogContent>
	</Dialog>
</div>
