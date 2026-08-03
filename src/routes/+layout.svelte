<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$lib/components/ui/button';
	import { Toaster } from '$lib/components/ui/sonner';
	import { enhance } from '$app/forms';
	import type { LayoutServerData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutServerData } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header
	class="flex h-12 items-center justify-between border-b border-border bg-white px-2 shadow-sm"
>
	<a href="/apps" class="text-xl font-bold text-blue-700">mettem</a>

	<div class="flex items-center gap-3">
		{#if data.user}
			{#if data.isAdmin}
				<a href="/admin">
					<Button variant="ghost" size="sm">Админ</Button>
				</a>
			{/if}
			<span class="text-sm font-medium text-gray-700">{data.user.name}</span>
			<form method="post" action="/auth?/signOut" use:enhance>
				<Button variant="destructive" size="sm" type="submit">Выйти</Button>
			</form>
		{:else}
			<a href="/auth/login">
				<Button variant="default" size="sm">Войти</Button>
			</a>
		{/if}
	</div>
</header>

<main class="overflow-hidden">
	{@render children()}
</main>

<Toaster />
