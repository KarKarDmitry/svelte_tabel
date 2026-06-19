<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';

	let isDismissed = $derived($page.data.isDismissed);
	let lastDoc = $derived($page.data.lastDoc);
	let docs = $derived($page.data.documents);
	let departments = $derived($page.data.departments);
	let positions = $derived($page.data.positions);

	const typeLabels: Record<string, string> = {
		hiring: 'Приём',
		transfer: 'Перевод',
		dismissal: 'Увольнение'
	};

	let transferOpen = $state(false);
	let dismissOpen = $state(false);
	const today = new Date().toISOString().split('T')[0];

	async function cancelDoc(doc: any) {
		if (!confirm(`Отменить документ "${typeLabels[doc.type] || doc.type}" от ${doc.date}?`)) return;
		const form = new FormData();
		form.set('id', String(doc.id));
		await fetch('?/cancelDoc', { method: 'POST', body: form });
		window.location.reload();
	}
</script>

{#snippet cell(value: any, row: any, col: any)}
	{#if col.key === 'type'}
		<Badge variant={row.type === 'dismissal' ? 'destructive' : 'default'}>
			{typeLabels[row.type] || row.type}
		</Badge>
	{:else if col.key === 'departmentName'}
		{departments.find((d: any) => d.id === row.departmentId)?.name ?? '—'}
	{:else if col.key === 'positionName'}
		{positions.find((p: any) => p.id === row.positionId)?.name ?? '—'}
	{:else if col.format}
		{col.format(value, row)}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<div class="space-y-4">
	{#if lastDoc && !isDismissed}
		<div class="flex gap-2">
			<Dialog bind:open={transferOpen}>
				<DialogContent>
					<form method="post" action="?/transfer" class="flex flex-col gap-4" use:enhance>
						<p class="font-medium">Перевод сотрудника</p>
						<Input name="date" type="date" value={today} required />
						<select
							name="departmentId"
							required
							class="rounded-md border border-input px-3 py-2 text-sm"
						>
							{#each departments as d}
								<option value={d.id}>{d.name}</option>
							{/each}
						</select>
						<select
							name="positionId"
							required
							class="rounded-md border border-input px-3 py-2 text-sm"
						>
							{#each positions as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
						<Button type="submit">Сохранить</Button>
					</form>
				</DialogContent>
			</Dialog>
			<Button onclick={() => (transferOpen = true)} variant="outline">Перевести</Button>

			<Dialog bind:open={dismissOpen}>
				<DialogContent>
					<form method="post" action="?/dismiss" use:enhance>
						<p class="mb-4 font-medium">Подтвердите увольнение</p>
						<Input name="date" type="date" value={today} required />
						<Button variant="destructive" type="submit" class="mt-4">Подтвердить увольнение</Button>
					</form>
				</DialogContent>
			</Dialog>
			<Button onclick={() => (dismissOpen = true)} variant="destructive">Уволить</Button>
		</div>
	{/if}

	<DTable
		data={docs}
		columns={[
			{ key: 'date', label: 'Дата' },
			{ key: 'type', label: 'Тип' },
			{ key: 'docNumber', label: 'Номер приказа', mono: true },
			{ key: 'departmentName', label: 'Подразделение' },
			{ key: 'positionName', label: 'Должность' }
		]}
		{cell}
		rowActions={[{ label: 'Отменить', onclick: (row) => cancelDoc(row) }]}
	/>
</div>
