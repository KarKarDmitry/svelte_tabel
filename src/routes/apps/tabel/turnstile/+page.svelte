<script lang="ts">
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let fetched = $state<{ events?: any[]; page?: number; totalPages?: number }>({});
	let events = $derived(fetched.events ?? data.events);
	let totalPages = $derived(fetched.totalPages ?? data.totalPages);
	let pageNum = $derived(fetched.page ?? data.page);

	let searchVal = $derived(data.search ?? '');
	let eventIdVal = $derived(data.eventId ? String(data.eventId) : '');
	let dateFromVal = $derived(
		data.dateFrom ||
			(() => {
				const d = new Date();
				return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
			})()
	);
	let dateToVal = $derived(
		data.dateTo ||
			(() => {
				const d = new Date();
				return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
			})()
	);

	let eventTypes = $derived(data.eventTypes ?? []);

	$effect(() => {
		if (!data.dateFrom && !data.dateTo && dateFromVal && dateToVal) {
			const url = new URL('/apps/tabel/turnstile', page.url.origin);
			url.searchParams.set('dateFrom', dateFromVal);
			url.searchParams.set('dateTo', dateToVal);
			replaceState(url.pathname + url.search, {});
		}
	});

	async function navigate(opts?: { p?: number; resetPage?: boolean }) {
		const url = new URL('/apps/tabel/turnstile', page.url.origin);
		if (searchVal) url.searchParams.set('search', searchVal);
		if (eventIdVal) url.searchParams.set('eventId', String(eventIdVal));
		if (dateFromVal) url.searchParams.set('dateFrom', dateFromVal);
		if (dateToVal) url.searchParams.set('dateTo', dateToVal);
		const p = opts?.resetPage ? 1 : (opts?.p ?? pageNum);
		if (p > 1) url.searchParams.set('page', String(p));
		const res = await fetch(url);
		if (res.ok) {
			const j = await res.json();
			fetched = { events: j.events, page: j.page, totalPages: j.totalPages };
			replaceState(url.pathname + url.search, {});
		}
	}
</script>

{#snippet renderCell(value: any, row: any, col: any)}
	{#if col.key === 'datetime'}
		{new Date(value).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})}
	{:else if col.key === 'fullName'}
		{row.fullName || `${row.lastName} ${row.firstName}`}
	{:else if col.format}{col.format(value, row)}
	{:else}{value ?? '—'}
	{/if}
{/snippet}

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900">События турникета</h1>
	</div>

	<DTable
		data={events}
		columns={[
			{ key: 'datetime', label: 'Дата и время', mono: true },
			{ key: 'eventName', label: 'Событие' },
			{ key: 'employeeNumber', label: 'Таб. №', mono: true },
			{ key: 'fullName', label: 'Сотрудник' }
		]}
		cell={renderCell}
		filters={[
			{
				key: 'search',
				placeholder: 'ФИО или таб. №...',
				type: 'string',
				value: searchVal,
				onSearch: (v) => {
					searchVal = v;
					navigate({ resetPage: true });
				}
			},
			{
				key: 'eventId',
				placeholder: 'Событие',
				type: 'select',
				value: eventIdVal,
				options: eventTypes.map((e: any) => ({ value: String(e.id), label: e.name })),
				onSearch: (v) => {
					eventIdVal = v;
					navigate({ resetPage: true });
				}
			},
			{
				key: 'dateFrom',
				placeholder: 'Дата с',
				type: 'date',
				value: dateFromVal,
				onSearch: (v) => {
					dateFromVal = v;
					navigate({ resetPage: true });
				}
			},
			{
				key: 'dateTo',
				placeholder: 'Дата по',
				type: 'date',
				value: dateToVal,
				onSearch: (v) => {
					dateToVal = v;
					navigate({ resetPage: true });
				}
			}
		]}
		page={pageNum}
		{totalPages}
		onPageChange={(p) => navigate({ p })}
	/>
</div>
