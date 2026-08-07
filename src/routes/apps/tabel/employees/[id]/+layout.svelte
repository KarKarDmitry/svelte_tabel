<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Badge } from '$lib/components/ui/badge';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	let { children }: { children: Snippet } = $props();

	let emp = $derived(page.data.employee);
	let docCount = $derived(page.data.documents.length);
	let scheduleCount = $derived(page.data.scheduleCount);
	let passCount = $derived(page.data.passCount);

	const tabs = [
		{ href: (id: number) => `/apps/tabel/employees/${id}/main`, label: () => 'Основное' },
		{
			href: (id: number) => `/apps/tabel/employees/${id}/docs`,
			label: () => `Кадровые документы`,
			count: () => `${docCount}`
		},
		{
			href: (id: number) => `/apps/tabel/employees/${id}/schedule`,
			label: () => `График`,
			count: () => `${scheduleCount}`
		},
		{
			href: (id: number) => `/apps/tabel/employees/${id}/pass`,
			label: () => `Пропуск`,
			count: () => `${passCount}`
		},
		{
			href: (id: number) => `/apps/tabel/employees/${id}/events`,
			label: () => 'События турникета'
		},
		{ href: (id: number) => `/apps/tabel/employees/${id}/worktime`, label: () => 'Табельный учёт' }
	];
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div>
			<a href="/apps/tabel/employees" class="text-sm text-gray-500 hover:text-gray-700">
				<ArrowLeft class="mr-1 inline size-4" />Назад к списку</a
			>
			<h1 class="mt-1 text-2xl font-bold text-gray-900">
				{emp.lastName}
				{emp.firstName}
				{emp.middleName ?? ''}
			</h1>
			<p class="text-sm text-gray-500">Таб. № {emp.number}</p>
		</div>
	</div>

	<Tabs value={page.url.pathname}>
		<TabsList>
			{#each tabs as t}
				<a href={t.href(emp.id)}>
					<TabsTrigger value={t.href(emp.id)}>
						{t.label()}
						{#if t.count}
							<Badge class="font-mono">{t.count()}</Badge>
						{/if}
					</TabsTrigger>
				</a>
			{/each}
		</TabsList>
	</Tabs>

	{@render children()}
</div>
