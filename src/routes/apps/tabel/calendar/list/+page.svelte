<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from 'svelte-sonner';

	let { data }: { data: PageServerData } = $props();

	let fetched = $state<{ calendars?: any[] }>({});
	let calendars = $derived(fetched.calendars ?? data.calendars);
	let templates = $derived(data.templates);
	let generateOpen = $state(false);
	let calName = $state('');
	let selTplId = $state(0);
	let selYear = $state(new Date().getFullYear());
	let deleteTarget = $state<any>(null);
	let deleteOpen = $state(false);
	const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

	async function refresh() {
		const res = await fetch('/apps/tabel/calendar/list');
		if (res.ok) {
			const j = await res.json();
			fetched = { calendars: j.calendars };
		}
	}

	function confirmDelete(row: any) {
		deleteTarget = row;
		deleteOpen = true;
	}

	async function doDelete() {
		if (!deleteTarget) return;
		const f = new FormData();
		f.set('id', String(deleteTarget.id));
		const res = await fetch('/apps/tabel/calendar/list', { method: 'DELETE', body: f });
		deleteOpen = false;
		deleteTarget = null;
		if (res.ok) toast.success('Календарь удалён');
		else toast.error('Не удалось удалить календарь');
		await refresh();
	}

	function openGenerate() {
		selTplId = templates[0]?.id ?? 0;
		selYear = new Date().getFullYear();
		calName = `Производственный календарь — ${selYear}`;
		generateOpen = true;
	}

	const tabs = [
		{
			href: `/apps/tabel/calendar/list`,
			label: 'Производственные календари'
		},
		{ href: `/apps/tabel/calendar/templates`, label: 'Шаблоны' }
	];
</script>

<div>
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">Календари</h1>
		<Button onclick={openGenerate}>Создать по шаблону</Button>
	</div>

	<Tabs value={page.url.pathname}>
		<TabsList>
			{#each tabs as t}
				<a href={t.href}>
					<TabsTrigger value={t.href}>
						{t.label}
					</TabsTrigger>
				</a>
			{/each}
		</TabsList>
	</Tabs>

	{#snippet renderCell(value: any, row: any, col: any)}
		{#if col.key === 'isDefault'}
			<Badge variant={value ? 'default' : 'outline'}>{value ? '✓' : '\u2014'}</Badge>
		{:else}
			{value}
		{/if}
	{/snippet}

	<DTable
		data={calendars}
		columns={[
			{ key: 'name', label: 'Название' },
			{ key: 'year', label: 'Год' },
			{
				key: 'isDefault',
				label: 'Основной',
				mono: true
			}
		]}
		cell={renderCell}
		rowActions={[
			{ label: 'Открыть', onclick: (row) => goto(`/apps/tabel/calendar/list/${row.id}/main`) },
			{
				label: 'Сделать основным',
				onclick: (row) => {
					const form = document.getElementById('setDefaultForm') as HTMLFormElement;
					(form.elements.namedItem('id') as HTMLInputElement).value = String(row.id);
					form.requestSubmit();
				}
			},
			{ label: 'Удалить', onclick: (row) => confirmDelete(row) }
		]}
		onRowClick={(row) => goto(`/apps/tabel/calendar/list/${row.id}/main`)}
	/>

	<Dialog bind:open={generateOpen}>
		<DialogContent>
			<p class="font-bold">Создать календарь</p>
			<form method="post" action="?/generate" class="flex flex-col gap-4" use:enhance>
				<div class="flex flex-col gap-1">
					<label for="name" class="text-sm font-medium">Название</label>
					<Input id="name" name="name" bind:value={calName} required />
				</div>
				<div class="flex flex-col gap-1">
					<label for="templateId" class="text-sm font-medium">Шаблон (для правил)</label>
					<select
						id="templateId"
						name="templateId"
						bind:value={selTplId}
						required
						class="rounded-md border border-input px-3 py-2 text-sm"
					>
						{#each templates as t}
							<option value={t.id}>{t.name}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-1">
					<label for="year" class="text-sm font-medium">Год</label>
					<select
						id="year"
						name="year"
						bind:value={selYear}
						onchange={() => (calName = `Производственный календарь — ${selYear}`)}
						class="rounded-md border border-input px-3 py-2 text-sm"
					>
						{#each years as y}
							<option value={y}>{y}</option>
						{/each}
					</select>
				</div>
				<Button type="submit">Создать</Button>
			</form>
		</DialogContent>
	</Dialog>

	<form
		id="setDefaultForm"
		method="post"
		action="?/setDefault"
		use:enhance={() => {
			return async ({ result }) => {
				if (result.type === 'success') toast.success('Календарь установлен основным');
				await refresh();
			};
		}}
		class="hidden"
	>
		<input type="hidden" name="id" value="" />
	</form>

	<Dialog bind:open={deleteOpen}>
		<DialogContent>
			<p class="font-bold">Удалить календарь?</p>
			<p class="text-sm text-gray-500">
				Вы уверены, что хотите удалить «{deleteTarget?.name}»? Это действие нельзя отменить.
			</p>
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => (deleteOpen = false)}>Отмена</Button>
				<Button variant="destructive" onclick={doDelete}>Удалить</Button>
			</div>
		</DialogContent>
	</Dialog>
</div>
