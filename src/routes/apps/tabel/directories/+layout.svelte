<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Separator } from '$lib/components/ui/separator';

	let { children }: { children: Snippet } = $props();

	let isAdmin = $derived($page.data.isAdmin ?? false);

	const tabs = $derived([
		{ href: '/apps/tabel/directories/departments', label: 'Подразделения' },
		{ href: '/apps/tabel/directories/positions', label: 'Должности' },
		{ href: '/apps/tabel/directories/department-groups', label: 'Группы подразделений' },
		...(isAdmin
			? [
					{ href: '/apps/tabel/directories/passes', label: 'Пропуска' },
					{ href: '/apps/tabel/directories/marks', label: 'Метки табеля' },
					{ href: '/apps/tabel/directories/constants', label: 'Константы' }
				]
			: [])
	]);
</script>

<div class="space-y-4">
	<h1 class="text-2xl font-bold text-foreground">Справочники</h1>

	<Tabs value={$page.url.pathname}>
		<TabsList>
			{#each tabs as t}
				<a href={t.href}>
					<TabsTrigger value={t.href}>{t.label}</TabsTrigger>
				</a>
			{/each}
		</TabsList>
	</Tabs>

	{@render children()}
</div>
