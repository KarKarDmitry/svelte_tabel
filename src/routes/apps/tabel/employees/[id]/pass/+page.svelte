<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let assignOpen = $state(false);

	async function removePass(id: number) {
		const form = new FormData();
		form.set('id', String(id));
		const res = await fetch('?/removePass', { method: 'POST', body: form });
		if (res.ok) toast.success('Пропуск снят');
		else toast.error('Не удалось снять пропуск');
		await invalidateAll();
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'passLabel'}
		<span class="font-mono">{row.pass.seria ? `${row.pass.seria} ` : ''}{row.pass.number}</span>
	{:else if col.key === 'dateFrom'}
		{row.employeePass.dateFrom ?? '—'}
	{:else if col.key === 'dateTo'}
		{row.employeePass.dateTo ?? 'текущий'}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<div>
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Пропуска ({data.passHistory.length})</h2>
		<Button onclick={() => (assignOpen = true)}>Выдать пропуск</Button>
	</div>

	<DTable
		data={data.passHistory}
		columns={[
			{ key: 'passLabel', label: 'Пропуск' },
			{ key: 'dateFrom', label: 'Выдан' },
			{ key: 'dateTo', label: 'Закрыт' }
		]}
		{cell}
		rowActions={[{ label: 'Открепить', onclick: (row) => removePass(row.employeePass.id) }]}
	/>
</div>

<Dialog bind:open={assignOpen}>
	<DialogContent>
		<form method="post" action="?/assignPass" class="flex flex-col gap-4" use:enhance>
			<p class="font-medium">Выдать пропуск</p>
			<select name="passId" required class="rounded-md border border-input px-3 py-2 text-sm">
				{#each data.allPasses.filter((p: any) => !(data as any).occupiedPassIds?.includes(p.id)) as p}
					<option value={p.id}>{p.seria ? `${p.seria} ` : ''}{p.number}</option>
				{/each}
			</select>
			<Input name="dateFrom" type="date" value={new Date().toISOString().split('T')[0]} required />
			<Button type="submit">Выдать</Button>
		</form>
	</DialogContent>
</Dialog>
