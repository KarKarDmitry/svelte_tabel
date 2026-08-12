<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Button } from '$lib/components/ui/button';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import { Toaster } from '$lib/components/ui/sonner';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { LayoutServerData } from './$types';
	import type { Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: LayoutServerData } = $props();

	/** Нативная (XP) ветка — у неё своя шапка/стили в native/apps/+layout.svelte */
	const isNative = $derived($page.url.pathname.startsWith('/native'));
	const currentUserName = $derived(data.user?.name ?? '');
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
							<a class="native-btn native-btn-small" href="/admin">Админ-панель</a>
						{/if}
						<span class="native-topbar-user">{data.user.name}</span>
						<a class="native-btn native-btn-small" href="/native/settings">Настройки</a>
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
						<Button variant="outline" size="sm">Админ-панель</Button>
					</a>
				{/if}
				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="sm">{currentUserName}</Button>
						{/snippet}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>
							{#snippet child({ props })}
								<a {...props} href="/settings">Настройки</a>
							{/snippet}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
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
