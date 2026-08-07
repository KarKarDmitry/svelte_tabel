<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$lib/components/ui/button';
	import { Toaster } from '$lib/components/ui/sonner';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { LayoutServerData } from './$types';
	import type { Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: LayoutServerData } = $props();

	/** Нативная (XP) ветка — у неё своя шапка/стили в native/apps/+layout.svelte */
	const isNative = $derived($page.url.pathname.startsWith('/native'));
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if isNative}
	<table class="native-topbar">
		<tbody>
			<tr>
				<td class="native-topbar-brand">
					<a href="/native/apps/tabel/tabel">mettem</a>
				</td>
				<td class="native-topbar-right">
					{#if data.user}
						{#if data.isAdmin}
							<a class="native-link" href="/admin">Админ</a>
						{/if}
						<span class="native-topbar-user">{data.user.name}</span>
						<form method="post" action="/auth?/signOut" class="native-topbar-form">
							<button type="submit" class="native-btn native-btn-small">Выйти</button>
						</form>
					{:else}
						<a class="native-btn native-btn-small" href="/auth/login">Войти</a>
					{/if}
				</td>
			</tr>
		</tbody>
	</table>
{:else}
	<header
		class="flex h-12 items-center justify-between border-b border-border bg-white px-2 shadow-sm"
	>
		<a href="/apps" class="text-xl font-bold text-blue-700">mettem</a>

		<div class="flex items-center gap-3">
			<a
				href="/native/apps/"
				class="text-sm text-gray-500 underline-offset-2 hover:underline"
				title="Упрощённая версия для старых браузеров (Windows XP)"
			>
				Версия для XP
			</a>
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
{/if}

<main class:overflow-hidden={!isNative}>
	{@render children()}
</main>

{#if !isNative}
	<Toaster />
{/if}
