<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { page } from '$app/stores';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
	let fetched = $state<{ dayMarks?: any[]; search?: string }>({});
	let dayMarks = $derived(fetched.dayMarks ?? data.dayMarks);
	let search = $derived(fetched.search ?? data.search);

	async function onSearch(value: string) {
		const url = new URL($page.url);
		url.searchParams.set('search', value);
		history.replaceState({}, '', url);
		const res = await fetch(url);
		if (res.ok) {
			const j = await res.json();
			fetched = { dayMarks: j.dayMarks, search: value };
		}
	}

	let editOpen = $state(false);
	let editRow = $state<any>(null);
	let action = $state('create');
	const categories = [
		{ v: 'work', l: 'Работа' },
		{ v: 'paid_absence', l: 'Оплач.' },
		{ v: 'unpaid_absence', l: 'Неоплач.' },
		{ v: 'violation', l: 'Нарушение' },
		{ v: 'day_off', l: 'Выходной' }
	];
	function openCreate() {
		action = 'create';
		editRow = null;
		editOpen = true;
	}
	function openEdit(row: any) {
		action = 'update';
		editRow = row;
		editOpen = true;
	}
</script>

{#snippet renderCell(value: any, row: any, col: any)}
	{#if col.key === 'category'}
		{#if value === 'work'}
			<Badge variant="default">Работа</Badge>
		{:else if value === 'paid_absence'}
			<Badge variant="secondary">Оплач.</Badge>
		{:else if value === 'unpaid_absence'}
			<Badge variant="outline">Неоплач.</Badge>
		{:else if value === 'violation'}
			<Badge variant="destructive">Нарушение</Badge>
		{:else if value === 'day_off'}
			<Badge variant="ghost">Выходной</Badge>
		{:else}
			<Badge variant="outline">{value ?? '—'}</Badge>
		{/if}
	{:else if col.format}
		{col.format(value, row)}
	{:else}
		{value ?? '—'}
	{/if}
{/snippet}

<DTable
	data={dayMarks}
	columns={[
		{ key: 'name', label: 'Название' },
		{ key: 'shortName', label: 'Сокр.' },
		{ key: 'code', label: 'Код' },
		{ key: 'category', label: 'Категория' },
		{ key: 'reportCode', label: 'Код отчёта' }
	]}
	cell={renderCell}
	filters={[{ key: 'search', placeholder: 'Поиск...', type: 'string', value: search, onSearch }]}
	actions={[{ label: 'Добавить', onclick: () => openCreate() }]}
	rowActions={[
		{ label: 'Редактировать', onclick: (row) => openEdit(row) },
		{ label: 'Удалить', onclick: (row) => {} }
	]}
	onRowClick={(row) => openEdit(row)}
/>

<Dialog bind:open={editOpen}>
	<DialogContent>
		<form method="post" action={'?/' + action} class="flex flex-col gap-4">
			<input type="hidden" name="id" value={editRow?.id ?? ''} />
			<p class="font-medium">{action === 'create' ? 'Новая метка' : 'Редактировать метку'}</p>
			<div>
				<label for="name" class="text-sm font-medium text-gray-700">Название</label>
				<Input
					id="name"
					name="name"
					value={editRow?.name ?? ''}
					placeholder="Полное название"
					required
				/>
			</div>
			<div>
				<label for="shortName" class="text-sm font-medium text-gray-700">Сокращение</label>
				<Input
					id="shortName"
					name="shortName"
					value={editRow?.shortName ?? ''}
					placeholder="Короткое"
					required
				/>
			</div>
			<div>
				<label for="code" class="text-sm font-medium text-gray-700">Код</label>
				<Input id="code" name="code" value={editRow?.code ?? ''} placeholder="Код" required />
			</div>
			<div>
				<label class="flex flex-col text-sm font-medium text-gray-700">
					Категория
					<select
						id="category"
						name="category"
						class="rounded-md border border-input px-3 py-2 text-sm"
					>
						<option value="" disabled selected={!editRow?.category}>Категория...</option>
						{#each categories as c}
							<option value={c.v} selected={editRow?.category === c.v}>{c.l}</option>
						{/each}
					</select>
				</label>
			</div>
			<div>
				<label for="reportCode" class="text-sm font-medium text-gray-700">Код отчёта</label>
				<Input
					id="reportCode"
					name="reportCode"
					value={editRow?.reportCode ?? ''}
					placeholder="Код отчёта"
				/>
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					name="reportExclude"
					value="true"
					checked={editRow?.reportExclude ?? false}
					class="rounded border-input"
				/>
				Исключить из отчётов
			</label>
			<Button type="submit">{action === 'create' ? 'Создать' : 'Сохранить'}</Button>
		</form>
	</DialogContent>
</Dialog>
