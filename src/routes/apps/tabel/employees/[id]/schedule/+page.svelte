<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import * as Item from '$lib/components/ui/item';
	import { Info } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	let assignOpen = $state(false);

	async function removeSchedule(id: number) {
		const form = new FormData();
		form.set('id', String(id));
		const res = await fetch('?/removeSchedule', { method: 'POST', body: form });
		if (res.ok) toast.success('График снят');
		else toast.error('Не удалось снять график');
		await invalidateAll();
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'hours'}
		{Math.floor(row.schedule.standardWorkTime / 60)}ч
	{:else if col.key === 'name'}
		{row.schedule.name}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<div>
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Графики ({data.scheduleHistory.length})</h2>
		<Button onclick={() => (assignOpen = true)}>Назначить график</Button>
	</div>

	<DTable
		data={data.scheduleHistory}
		columns={[
			{ key: 'name', label: 'График' },
			{ key: 'hours', label: 'Норма' }
		]}
		{cell}
		rowActions={[{ label: 'Открепить', onclick: (row) => removeSchedule(row.employeeSchedule.id) }]}
	/>

	<Item.Root variant="outline" class="mt-4 w-fit border-2 border-amber-500 bg-amber-50">
		<Item.Media variant="icon">
			<Info class="size-5 text-amber-500" />
		</Item.Media>
		<Item.Content>
			<Item.Title class="text-amber-800">Рекомендация</Item.Title>
			<Item.Description>
				Назначайте один график сотруднику, чтобы избежать конфликтов при расчёте табеля и расцветке
				ячеек
			</Item.Description>
		</Item.Content>
	</Item.Root>
</div>

<Dialog bind:open={assignOpen}>
	<DialogContent>
		<form method="post" action="?/assignSchedule" class="flex flex-col gap-4" use:enhance>
			<p class="font-medium">Назначить график</p>
			<select name="scheduleId" required class="rounded-md border border-input px-3 py-2 text-sm">
				{#each data.allSchedules as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
			<Input name="dateFrom" type="date" value={new Date().toISOString().split('T')[0]} required />
			<Button type="submit">Назначить</Button>
		</form>
	</DialogContent>
</Dialog>
