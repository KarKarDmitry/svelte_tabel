<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let fetched = $state<{ passes?: any[]; seriaSearch?: string; numberSearch?: string }>({});
	let passes = $derived(fetched.passes ?? data.passes);
	let seriaVal = $derived(data.seriaSearch);
	let numberVal = $derived(data.numberSearch);

	async function navigate() {
		const url = new URL($page.url);
		if (seriaVal) url.searchParams.set('seria', seriaVal);
		else url.searchParams.delete('seria');
		if (numberVal) url.searchParams.set('number', numberVal);
		else url.searchParams.delete('number');
		history.replaceState({}, '', url);
		const res = await fetch(url);
		if (res.ok) {
			const json = await res.json();
			fetched = { passes: json.passes, seriaSearch: seriaVal, numberSearch: numberVal };
		}
	}

	let editOpen = $state(false);
	let editRow = $state<any>(null);
	let action = $state('create');

	function openCreate() {
		action = 'create';
		editRow = null;
		editOpen = true;
	}

	function openEdit(row: any) {
		action = 'update';
		editRow = { ...row };
		editOpen = true;
	}

	function ownerLabel(row: any): string {
		const o = row.owner;
		if (!o) return '—';
		return `${o.number} - ${o.lastName} ${o.firstName}`;
	}

	async function deletePass(id: number) {
		if (!confirm('Удалить пропуск?')) return;
		const form = new FormData();
		form.set('id', String(id));
		await fetch('/apps/tabel/directories/passes', { method: 'DELETE', body: form });
		navigate();
	}
</script>

{#snippet renderCell(value: any, row: any, col: any)}
	{#if col.key === 'ownerLabel'}
		{ownerLabel(row)}
	{:else if col.key === 'seria'}
		{row.pass?.seria ?? '—'}
	{:else if col.key === 'number'}
		{row.pass?.number ?? '—'}
	{:else if col.format}
		{col.format(value, row)}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<DTable
	data={passes}
	columns={[
		{ key: 'seria', label: 'Серия' },
		{ key: 'number', label: 'Номер', mono: true },
		{ key: 'ownerLabel', label: 'Владелец' }
	]}
	cell={renderCell}
	filters={[
		{
			key: 'seria',
			placeholder: 'Серия...',
			type: 'string',
			value: seriaVal,
			onSearch: (v) => {
				seriaVal = v;
				navigate();
			}
		},
		{
			key: 'number',
			placeholder: 'Номер...',
			type: 'string',
			value: numberVal,
			onSearch: (v) => {
				numberVal = v;
				navigate();
			}
		}
	]}
	actions={[{ label: 'Добавить', onclick: () => openCreate() }]}
	rowActions={[
		{ label: 'Редактировать', onclick: (row) => openEdit(row) },
		{ label: 'Удалить', onclick: (row) => deletePass(row.pass.id) }
	]}
	onRowClick={(row) => openEdit(row)}
/>

<Dialog bind:open={editOpen}>
	<DialogContent>
		<form
			method="post"
			action={'?/' + action}
			class="flex flex-col gap-4"
			use:enhance={() => {
				return async () => {
					editOpen = false;
					navigate();
				};
			}}
		>
			<input type="hidden" name="id" value={editRow?.pass?.id ?? ''} />
			<p class="font-medium">{action === 'create' ? 'Новый' : 'Редактировать'} пропуск</p>
			<div>
				<label for="seria" class="text-sm font-medium text-gray-700">Серия</label>
				<Input id="seria" name="seria" value={editRow?.pass?.seria ?? ''} placeholder="Серия" />
			</div>
			<div>
				<label for="number" class="text-sm font-medium text-gray-700">Номер</label>
				<Input
					id="number"
					name="number"
					value={editRow?.pass?.number ?? ''}
					placeholder="Номер"
					required
				/>
			</div>
			<Button type="submit">{action === 'create' ? 'Создать' : 'Сохранить'}</Button>
		</form>
	</DialogContent>
</Dialog>
