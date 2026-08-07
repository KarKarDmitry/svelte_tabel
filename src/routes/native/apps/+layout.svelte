<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { Flex } from '$lib/components/native/ui';

	let { children }: { children: Snippet } = $props();

	const current = $derived($page.url.pathname);
</script>

<svelte:head>
	<link rel="stylesheet" href="/native.css" />
	<script src="/native-collapse.js"></script>
</svelte:head>

<div class="native-page">
	<div class="n-flex-nav">
		<Flex>
			<a
				href="/native/apps/tabel/tabel"
				class="native-link"
				class:active={current.startsWith('/native/apps/tabel/tabel')}
			>
				Табель
			</a>
			<a
				href="/native/apps/tabel/employees"
				class="native-link"
				class:active={current.startsWith('/native/apps/tabel/employees')}
			>
				Сотрудники
			</a>
			<a
				href="/native/apps/tabel/turnstile"
				class="native-link"
				class:active={current.startsWith('/native/apps/tabel/turnstile')}
			>
				Турникет
			</a>
			<a
				href="/native/apps/tabel/schedules"
				class="native-link"
				class:active={current.startsWith('/native/apps/tabel/schedules')}
			>
				Графики
			</a>
			<a
				href="/native/apps/tabel/calendar"
				class="native-link"
				class:active={current.startsWith('/native/apps/tabel/calendar')}
			>
				Календарь
			</a>
			<a
				href="/native/apps/tabel/directories"
				class="native-link"
				class:active={current.startsWith('/native/apps/tabel/directories')}
			>
				Справочники
			</a>
			{#if $page.data.isAdmin}
				<a
					href="/native/apps/tabel/import"
					class="native-link padded"
					class:active={current.startsWith('/native/apps/tabel/import')}
				>
					Импорт
				</a>
			{/if}
			<span class="native-spacer"></span>
			<a href="/apps/tabel/tabel?native_only=0" class="native-exit">Полная версия</a>
		</Flex>
	</div>
	{@render children()}
</div>

<style>
	.n-flex-nav {
		border-bottom: 2px solid #afafaf;
		margin-bottom: 10px;
	}
</style>
