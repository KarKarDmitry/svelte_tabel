<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { page } from '$app/stores';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let canEdit = $derived($page.data.canEdit ?? false);

	let fetched = $state<{ positions?: any[]; search?: string }>({});

	let positions = $derived(fetched.positions ?? data.positions);
	let search = $derived(fetched.search ?? data.search);

	async function onSearch(value: string) {
		const url = new URL($page.url);
		url.searchParams.set('search', value);
		history.replaceState({}, '', url);
		const res = await fetch(url);
		if (res.ok) {
			const json = await res.json();
			fetched = { positions: json.positions, search: value };
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
		editRow = row;
		editOpen = true;
	}
</script>

<DTable
	data={positions}
	columns={[{ key: 'name', label: 'Название' }]}
	filters={[{ key: 'search', placeholder: 'Поиск...', type: 'string', value: search, onSearch }]}
	actions={canEdit ? [{ label: 'Добавить', onclick: () => openCreate() }] : []}
	rowActions={canEdit
		? [
				{ label: 'Редактировать', onclick: (row) => openEdit(row) },
				{ label: 'Удалить', onclick: (row) => {} }
			]
		: []}
	onRowClick={canEdit ? (row) => openEdit(row) : undefined}
/>

<Dialog bind:open={editOpen}>
	<DialogContent>
		<form method="post" action={'?/' + action} class="flex flex-col gap-4">
			<input type="hidden" name="id" value={editRow?.id ?? ''} />
			<p class="font-medium">{action === 'create' ? 'Новая' : 'Редактировать'} должность</p>
			<div>
				<Label for="name">Название</Label>
				<Input id="name" name="name" value={editRow?.name ?? ''} placeholder="Название" required />
			</div>
			<Button type="submit">{action === 'create' ? 'Создать' : 'Сохранить'}</Button>
		</form>
	</DialogContent>
</Dialog>
