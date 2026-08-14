<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import DTable from '$lib/components/DTable/DTable.svelte';
	import { goto, replaceState, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let canEdit = $derived(page.data.canEdit ?? false);
	let isAdmin = $derived(page.data.isAdmin ?? false);
	let deleteTarget = $state<any>(null);
	let deleteOpen = $state(false);

	let fetched = $state<{
		employees?: any[];
		page?: number;
		totalPages?: number;
		total?: number;
		sort?: string;
		order?: string;
	}>({});

	let employees = $derived(fetched.employees ?? data.employees);
	let total = $derived(fetched.total ?? data.total);
	let totalPages = $derived(fetched.totalPages ?? data.totalPages);
	let pageNum = $derived(fetched.page ?? data.page);
	let currentSort = $derived(fetched.sort);
	let currentOrder = $derived(fetched.order as 'asc' | 'desc');

	let deptVal = $state('');
	let posVal = $state('');
	let statusVal = $state('');
	let searchVal = $state(page.url.searchParams.get('search') || '');

	function qs(val: string) {
		return val ? val : '';
	}

	async function navigate(opts: Record<string, string>) {
		const url = new URL(page.url);
		// Берём значения из opts или из локальных стейтов
		const params: Record<string, string> = {
			search: 'search' in opts ? opts.search : searchVal,
			department: 'department' in opts ? opts.department : deptVal,
			position: 'position' in opts ? opts.position : posVal,
			status: 'status' in opts ? opts.status : statusVal,
			page: '1',
			sort: currentSort || 'asc',
			order: currentOrder,
			...opts
		};

		for (const [k, v] of Object.entries(params)) {
			if (v) url.searchParams.set(k, v);
			else url.searchParams.delete(k);
		}

		const res = await fetch(url);
		if (res.ok) {
			const json = await res.json();
			fetched = {
				employees: json.employees,
				page: json.page,
				totalPages: json.totalPages,
				total: json.total,
				sort: json.sort,
				order: json.order
			};
			replaceState(url.pathname + url.search, {});
		}
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Сотрудники</h1>
			<p class="text-sm text-muted-foreground">Всего: {total}</p>
		</div>
		{#if canEdit}
			<Button onclick={() => goto('/apps/tabel/employees/create')}>Добавить сотрудника</Button>
		{/if}
	</div>

	{#snippet renderCell(value: any, row: any, col: any)}
		{#if col.key === 'status'}
			<div class="flex justify-center">
				{#if value === 'active'}
					<Badge variant="default">Активен</Badge>
				{:else if value === 'dismissed'}
					<Badge variant="destructive">Уволен</Badge>
				{:else}
					<Badge variant="outline">Ожидает</Badge>
				{/if}
			</div>
		{:else if col.format}
			{col.format(value, row)}
		{:else}
			{value ?? '—'}
		{/if}
	{/snippet}

	<DTable
		data={employees}
		columns={[
			{ key: 'number', label: 'Таб. №', sortable: true, mono: true },
			{
				key: 'lastName',
				label: 'ФИО',
				sortable: true,
				format: (v, r) => `${r.lastName} ${r.firstName} ${r.middleName ?? ''}`
			},
			{ key: 'departmentName', label: 'Подразделение', format: (v) => v || '—' },
			{ key: 'positionName', label: 'Должность', format: (v) => v || '—' },
			{ key: 'status', label: 'Статус' }
		]}
		cell={renderCell}
		filters={[
			{
				key: 'search',
				placeholder: 'Поиск по ФИО или номеру...',
				type: 'string',
				value: searchVal,
				onSearch: (v) => {
					searchVal = v;
					navigate({ search: v });
				}
			},
			{
				key: 'department',
				placeholder: 'Подразделение...',
				type: 'string',
				value: deptVal,
				refs: data.departments,
				onSearch: (v) => {
					deptVal = v;
					navigate({ department: v });
				}
			},
			{
				key: 'position',
				placeholder: 'Должность...',
				type: 'string',
				value: posVal,
				refs: data.positions,
				onSearch: (v) => {
					posVal = v;
					navigate({ position: v });
				}
			},
			{
				key: 'status',
				placeholder: 'Статус',
				type: 'select',
				value: statusVal,
				options: [
					{ value: 'active', label: 'Активные' },
					{ value: 'dismissed', label: 'Уволенные' }
				],
				onSearch: (v) => {
					statusVal = v;
					navigate({ status: v });
				}
			}
		]}
		rowActions={[
			{ label: 'Открыть', onclick: (row) => goto(`/apps/tabel/employees/${row.id}`) },
			{ label: 'Уволить', onclick: (row) => {} },
			...(isAdmin
				? [
						{
							label: 'Удалить',
							variant: 'destructive' as const,
							onclick: (row: any) => ((deleteTarget = row), (deleteOpen = true))
						}
					]
				: [])
		]}
		onRowClick={(row) => goto(`/apps/tabel/employees/${row.id}`)}
		page={pageNum}
		{totalPages}
		onPageChange={(p) => navigate({ page: String(p) })}
		sort={currentSort}
		order={currentOrder as 'asc' | 'desc'}
		onSort={(key) => {
			const o = currentSort === key && currentOrder === 'asc' ? 'desc' : 'asc';
			navigate({ sort: key, order: o });
		}}
	/>

	{#if deleteTarget}
		<Dialog bind:open={deleteOpen}>
			<DialogContent class="max-w-md">
				<DialogHeader>
					<DialogTitle class="text-destructive">Удалить сотрудника?</DialogTitle>
				</DialogHeader>
				<div class="space-y-3 text-sm">
					<div>Вы уверены, что хотите полностью удалить</div>
					<span>№ {deleteTarget.number} - </span>
					<span>
						{deleteTarget.lastName}
						{deleteTarget.firstName}
						{deleteTarget.middleName ?? ''}
					</span>
					?
					<div
						class="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-destructive"
					>
						<p class="font-semibold">Это действие необратимо!</p>
						<p class="mt-1">Будут безвозвратно удалены все связанные данные:</p>
						<ul class="mt-1 list-disc pl-5">
							<li>кадровые документы (приёмы, переводы, увольнения, отпуска);</li>
							<li>графики и назначения пропусков;</li>
							<li>табельный учёт и события турникета за все месяцы.</li>
						</ul>
						<p class="mt-1 font-semibold">Восстановление невозможно!</p>
					</div>
				</div>
				<form
					method="post"
					action="?/delete"
					class="flex justify-end gap-2"
					use:enhance={() => {
						return async ({ result }) => {
							if (result.type === 'success') {
								deleteTarget = null;
								deleteOpen = false;
								fetched = {};
								await invalidateAll();
								toast.success('Сотрудник удалён');
							} else if (result.type === 'failure') {
								toast.error((result.data as any)?.message ?? 'Не удалось удалить сотрудника');
							}
						};
					}}
				>
					<input type="hidden" name="id" value={deleteTarget.id} />
					<Button type="button" variant="outline" onclick={() => (deleteTarget = null)}>
						Отмена
					</Button>
					<Button type="submit" variant="destructive">Удалить навсегда</Button>
				</form>
			</DialogContent>
		</Dialog>
	{/if}
</div>
