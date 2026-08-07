<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { PageHeader, Tabs } from '$lib/components/native/ui';

	let { children }: { children: Snippet } = $props();

	const current = $derived($page.url.pathname);
	const isAdmin = $derived($page.data.isAdmin ?? false);

	const tabs = $derived([
		{ href: '/native/apps/tabel/directories/departments', label: 'Подразделения' },
		{ href: '/native/apps/tabel/directories/positions', label: 'Должности' },
		{ href: '/native/apps/tabel/directories/department-groups', label: 'Группы подразделений' },
		...(isAdmin
			? [
					{ href: '/native/apps/tabel/directories/passes', label: 'Пропуска' },
					{ href: '/native/apps/tabel/directories/marks', label: 'Метки табеля' },
					{ href: '/native/apps/tabel/directories/constants', label: 'Константы' }
				]
			: [])
	]);
</script>

<PageHeader title="Справочники" />
<Tabs items={tabs} active={current} />

{@render children()}
