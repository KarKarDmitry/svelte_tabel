<script lang="ts">
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import type { Snippet } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	let { children }: { children: Snippet } = $props();
	let tpl = $derived(page.data.template);

	const tabs = [
		{ href: (id: number) => `/apps/tabel/calendar/templates/${id}/main`, label: 'Основное' },
		{
			href: (id: number) => `/apps/tabel/calendar/templates/${id}/special_days`,
			label: `Особые дни`,
			count: page.data.rules.length
		}
	];
</script>

<div class="space-y-4">
	<div class="flex items-center gap-4">
		<a href="/apps/tabel/calendar/templates" class="text-sm text-muted-foreground hover:text-foreground"
			><ArrowLeft class="mr-1 inline size-4" />К шаблонам</a
		>
		<h1 class="text-2xl font-bold text-foreground">{tpl.name}</h1>
	</div>

	<Tabs value={page.url.pathname}>
		<TabsList>
			{#each tabs as t}
				<a href={t.href(tpl.id)}>
					<TabsTrigger value={t.href(tpl.id)}>
						{t.label}
						{#if t.count}
							<Badge class="font-mono">{t.count}</Badge>
						{/if}
					</TabsTrigger>
				</a>
			{/each}
		</TabsList>
	</Tabs>

	{@render children()}
</div>
