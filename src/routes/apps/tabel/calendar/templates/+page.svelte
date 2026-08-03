<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';

	let { data }: { data: PageServerData } = $props();

	let fetched = $state<{ templates?: any[] }>({});
	let templates = $derived(fetched.templates ?? data.templates);

	let createOpen = $state(false);
	let createName = $state('');
	let deleteTarget = $state<any>(null);
	let deleteOpen = $state(false);

	async function refresh() {
		const res = await fetch('/apps/tabel/calendar/templates');
		if (res.ok) {
			const j = await res.json();
			fetched = { templates: j.templates };
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
		const res = await fetch('/apps/tabel/calendar/templates', { method: 'DELETE', body: f });
		deleteOpen = false;
		deleteTarget = null;
		if (res.ok) toast.success('Шаблон удалён');
		else toast.error('Не удалось удалить шаблон');
		await refresh();
	}

	async function doCreate() {
		if (!createName) return;
		const f = new FormData();
		f.set('name', createName);
		const res = await fetch('/apps/tabel/calendar/templates', { method: 'POST', body: f });
		if (res.ok) {
			const j = await res.json();
			createOpen = false;
			createName = '';
			if (j.id) goto(`/apps/tabel/calendar/templates/${j.id}/main`);
			else await refresh();
		}
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
		<h1 class="text-2xl font-bold text-gray-900">Шаблоны календаря</h1>
		<Button
			onclick={() => {
				createOpen = true;
			}}>Добавить</Button
		>
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

	<DTable
		data={templates}
		columns={[{ key: 'name', label: 'Название' }]}
		rowActions={[
			{ label: 'Открыть', onclick: (row) => goto(`/apps/tabel/calendar/templates/${row.id}/main`) },
			{ label: 'Удалить', onclick: (row) => confirmDelete(row) }
		]}
		onRowClick={(row) => goto(`/apps/tabel/calendar/templates/${row.id}/main`)}
	/>

	<Dialog bind:open={createOpen}>
		<DialogContent>
			<p class="font-bold">Новый шаблон календаря</p>
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-1">
					<label for="name" class="text-sm font-medium">Название</label>
					<Input
						id="name"
						name="name"
						bind:value={createName}
						placeholder="Например: Производственный календарь"
						required
					/>
				</div>
				<Button onclick={doCreate}>Создать и перейти к настройке</Button>
			</div>
		</DialogContent>
	</Dialog>

	<Dialog bind:open={deleteOpen}>
		<DialogContent>
			<p class="font-bold">Удалить шаблон?</p>
			<p class="text-sm text-gray-500">
				Вы уверены, что хотите удалить шаблон «{deleteTarget?.name}»? Это действие нельзя отменить.
			</p>
			<div class="flex justify-end gap-2">
				<Button variant="outline" onclick={() => (deleteOpen = false)}>Отмена</Button>
				<Button variant="destructive" onclick={doDelete}>Удалить</Button>
			</div>
		</DialogContent>
	</Dialog>
</div>
