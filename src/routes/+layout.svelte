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
	import { SidebarProvider, SidebarTrigger, SidebarInset } from '$lib/components/ui/sidebar';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { sidebarNav } from '$lib/sidebar-nav.svelte';
	import { ModeWatcher, setMode, resetMode } from 'mode-watcher';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { LayoutServerData } from './$types';
	import type { Snippet } from 'svelte';

	let { children, data }: { children: Snippet; data: LayoutServerData } = $props();

	/** Нативная (XP) ветка — у неё своя шапка/стили в native/apps/+layout.svelte */
	const isNative = $derived($page.url.pathname.startsWith('/native'));
	const currentPath = $derived($page.url.pathname);
	const currentUserName = $derived(data.user?.name ?? '');

	/** Активен ли зарегистрированный раздел (для триггера в шапке и показа сайдбара) */
	const sidebarActive = $derived(
		!!sidebarNav.current && currentPath.startsWith(sidebarNav.current.root)
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if isNative}
		<link rel="stylesheet" href="/native.css" />
		<script src="/native-collapse.js"></script>
		<script src="/native-dialog.js"></script>
		<script src="/native-bulk.js"></script>
		<script src="/native-employee.js"></script>
	{/if}
</svelte:head>

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
							<a class="native-btn native-btn-small" href="/native/admin">Админ-панель</a>
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

	<main class="overflow-hidden">
		{@render children()}
	</main>
{:else}
	<ModeWatcher />
	<SidebarProvider class="flex-col">
		<header
			class="flex h-12 items-center justify-between border-b border-border bg-white px-2 shadow-sm dark:bg-background"
		>
			{#if sidebarActive}
				<div class="flex items-center gap-2">
					<SidebarTrigger class="md:hidden" />
					<a
						href="/apps"
						class="hidden text-sm font-bold text-blue-700 md:inline md:pl-12 md:text-xl dark:text-blue-400"
						>mettem</a
					>
				</div>
			{:else}
				<a
					href="/apps"
					class="text-sm font-bold text-blue-700 md:pl-12 md:text-xl dark:text-blue-400">mettem</a
				>
			{/if}

			<div class="flex items-center gap-2 md:gap-3">
				<a
					href="/native/apps/"
					class="hidden text-sm text-muted-foreground underline-offset-2 hover:underline md:inline dark:text-gray-400"
					title="Упрощённая версия для старых браузеров (Windows XP)"
				>
					Версия для XP
				</a>

				<!-- Переключатель темы -->
				<DropdownMenu>
					<DropdownMenuTrigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class="max-sm:h-7 max-sm:w-7"
								aria-label="Тема оформления"
							>
								<SunIcon
									class="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
								/>
								<MoonIcon
									class="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
								/>
								<span class="sr-only">Тема</span>
							</Button>
						{/snippet}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onclick={() => setMode('light')}>Светлая</DropdownMenuItem>
						<DropdownMenuItem onclick={() => setMode('dark')}>Тёмная</DropdownMenuItem>
						<DropdownMenuItem onclick={() => resetMode()}>Системная</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				{#if data.user}
					{#if data.isAdmin}
						<a href="/admin">
							<Button variant="outline" size="sm" class="max-sm:h-7 max-sm:px-2 max-sm:text-xs"
								>Админ-панель</Button
							>
						</a>
					{/if}
					<DropdownMenu>
						<DropdownMenuTrigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="ghost"
									size="sm"
									class="max-sm:h-7 max-sm:max-w-28 max-sm:truncate max-sm:px-2 max-sm:text-xs"
									>{currentUserName}</Button
								>
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
						<Button
							variant="destructive"
							size="sm"
							type="submit"
							class="max-sm:h-7 max-sm:px-2 max-sm:text-xs">Выйти</Button
						>
					</form>
				{:else}
					<a href="/auth/login">
						<Button variant="default" size="sm" class="max-sm:h-7 max-sm:px-2 max-sm:text-xs"
							>Войти</Button
						>
					</a>
				{/if}
			</div>
		</header>

		<div class="flex min-h-0 flex-1 flex-col md:flex-row">
			<!-- Сначала контент: раздел (внутри) успевает зарегистрировать навигацию,
					поэтому сайдбар рендерится уже с кнопками и при SSR -->
			<SidebarInset class="overflow-hidden p-6">
				{@render children()}
			</SidebarInset>
			<div class="md:order-first">
				<AppSidebar activePath={currentPath} />
			</div>
		</div>

		<Toaster />
	</SidebarProvider>
{/if}
