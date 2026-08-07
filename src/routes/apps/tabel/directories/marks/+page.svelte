<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { page } from '$app/stores';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let isAdmin = $derived($page.data.isAdmin ?? false);
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
	let category = $state('');
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
		category = '';
		editOpen = true;
	}
	function openEdit(row: any) {
		action = 'update';
		editRow = row;
		category = row.category ?? '';
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
	actions={isAdmin ? [{ label: 'Добавить', onclick: () => openCreate() }] : []}
	rowActions={isAdmin
		? [
				{ label: 'Редактировать', onclick: (row) => openEdit(row) },
				{ label: 'Удалить', onclick: (row) => {} }
			]
		: []}
	onRowClick={isAdmin ? (row) => openEdit(row) : undefined}
/>

<Dialog bind:open={editOpen}>
	<DialogContent>
		<form method="post" action={'?/' + action} class="flex flex-col gap-4">
			<input type="hidden" name="id" value={editRow?.id ?? ''} />
			<p class="font-medium">{action === 'create' ? 'Новая метка' : 'Редактировать метку'}</p>
			<div>
				<Label for="name">Название</Label>
				<Input
					id="name"
					name="name"
					value={editRow?.name ?? ''}
					placeholder="Полное название"
					required
				/>
			</div>
			<div>
				<Label for="shortName">Сокращение</Label>
				<Input
					id="shortName"
					name="shortName"
					value={editRow?.shortName ?? ''}
					placeholder="Короткое"
					required
				/>
			</div>
			<div>
				<Label for="code">Код</Label>
				<Input id="code" name="code" value={editRow?.code ?? ''} placeholder="Код" required />
			</div>
			<div>
				<Label class="gap-1">
					Категория
					<Select type="single" bind:value={category}>
						<SelectTrigger class="w-full">
							<span>{categories.find((c) => c.v === category)?.l ?? 'Категория...'}</span>
						</SelectTrigger>
						<SelectContent>
							{#each categories as c}<SelectItem value={c.v}>{c.l}</SelectItem>{/each}
						</SelectContent>
					</Select>
					<input type="hidden" name="category" value={category} />
				</Label>
			</div>
			<div>
				<Label for="reportCode">Код отчёта</Label>
				<Input
					id="reportCode"
					name="reportCode"
					value={editRow?.reportCode ?? ''}
					placeholder="Код отчёта"
				/>
			</div>
			<Label class="flex-row items-center gap-2">
				<Checkbox
					name="reportExclude"
					value="true"
					checked={editRow?.reportExclude ?? false}
					onCheckedChange={(c) => (editRow = { ...editRow, reportExclude: c === true })}
				/>
				Исключить из отчётов
			</Label>
			<Button type="submit">{action === 'create' ? 'Создать' : 'Сохранить'}</Button>
		</form>
	</DialogContent>
</Dialog>
