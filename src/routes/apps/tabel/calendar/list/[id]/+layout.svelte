<script lang="ts">
	import { page } from '$app/stores';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
	let cal = $derived($page.data.calendar);

	const tabs = [
		{ href: (id: number) => `/apps/tabel/calendar/list/${id}/main`, label: 'Календарь' },
		{ href: (id: number) => `/apps/tabel/calendar/list/${id}/special_days`, label: 'Особые дни' }
	];
</script>

<div>
	<div class="sticky top-0 -mx-6 bg-background/10 p-2 px-6 backdrop-blur-xs">
		<div class="flex items-center gap-4">
			<a
				href="/apps/tabel/calendar/list"
				class="text-sm whitespace-nowrap text-gray-500 hover:text-gray-700"
			>
				← К календарям
			</a>
			<h1 class="text-2xl font-bold text-gray-900">{cal.name}</h1>
		</div>

		<div>
			<Tabs value={$page.url.pathname}>
				<TabsList>
					{#each tabs as t}
						<a href={t.href(cal.id)}>
							<TabsTrigger value={t.href(cal.id)}>{t.label}</TabsTrigger>
						</a>
					{/each}
				</TabsList>
			</Tabs>
		</div>
	</div>

	{@render children()}
</div>
