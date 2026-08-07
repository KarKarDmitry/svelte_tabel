<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { page } from '$app/stores';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let isAdmin = $derived($page.data.isAdmin ?? false);
	let fetched = $state<{ constants?: any[]; search?: string }>({});
	let constants = $derived(fetched.constants ?? data.constants);
	let search = $derived(fetched.search ?? data.search);

	async function onSearch(value: string) {
		const url = new URL($page.url);
		url.searchParams.set('search', value);
		history.replaceState({}, '', url);
		const res = await fetch(url);
		if (res.ok) {
			const j = await res.json();
			fetched = { constants: j.constants, search: value };
		}
	}

	let editOpen = $state(false);
	let editRow = $state<any>(null);
	function openUpsert(row: any) {
		editRow = row;
		editOpen = true;
	}
</script>

<DTable
	data={constants}
	columns={[
		{ key: 'key', label: 'Ключ' },
		{ key: 'value', label: 'Значение' }
	]}
	filters={[{ key: 'search', placeholder: 'Поиск...', type: 'string', value: search, onSearch }]}
	rowActions={isAdmin
		? [
				{ label: 'Редактировать', onclick: (row) => openUpsert(row) },
				{ label: 'Удалить', onclick: (row) => {} }
			]
		: []}
	onRowClick={isAdmin ? (row) => openUpsert(row) : undefined}
/>

<Dialog bind:open={editOpen}>
	<DialogContent>
		<form method="post" action="?/upsert" class="flex flex-col gap-4">
			{#if editRow}
				<div>
					<input type="hidden" name="key" value={editRow.key} />
					<p class="font-medium">Редактировать константу</p>
				</div>
				<div>
					<Label for="key">Ключ</Label>
					<Input id="key" name="key" value={editRow.key} disabled />
				</div>
			{:else}
				<p class="font-medium">Новая константа</p>
				<div>
					<Label for="key">Ключ</Label>
					<Input id="key" name="key" placeholder="Ключ" required />
				</div>
			{/if}
			<div>
				<Label for="value">Значение</Label>
				<Input
					id="value"
					name="value"
					value={editRow?.value ?? ''}
					placeholder="Значение"
					required
				/>
			</div>
			<Button type="submit">Сохранить</Button>
		</form>
	</DialogContent>
</Dialog>
