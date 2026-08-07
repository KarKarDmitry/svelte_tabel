<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { PageHeader, Tabs, Badge } from '$lib/components/native/ui';

	let { children }: { children: Snippet } = $props();

	const data = $derived($page.data);
	const current = $derived($page.url.pathname);
	const id = $derived(data.employee?.id);

	const tabs = $derived([
		{ href: `/native/apps/tabel/employees/${id}/main`, label: 'Основное' },
		{
			href: `/native/apps/tabel/employees/${id}/docs`,
			label: 'Кадровые документы',
			badge: data.documents.length
		},
		{
			href: `/native/apps/tabel/employees/${id}/schedule`,
			label: 'График',
			badge: data.scheduleCount
		},
		{
			href: `/native/apps/tabel/employees/${id}/pass`,
			label: 'Пропуск',
			badge: data.passCount
		},
		{ href: `/native/apps/tabel/employees/${id}/events`, label: 'События турникета' },
		{ href: `/native/apps/tabel/employees/${id}/worktime`, label: 'Табельный учёт' }
	]);
</script>

<PageHeader
	title={`${data.employee?.lastName} ${data.employee?.firstName} ${data.employee?.middleName ?? ''}`}
	note={`Таб. № ${data.employee?.number}`}
	backHref="/native/apps/tabel/employees"
	backLabel="Назад к списку"
/>

<Tabs items={tabs} active={current} />

{@render children()}
