<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import { DataToolbar } from '$lib/components/data';
	import { DataPager } from '$lib/components/data';
	import { Empty } from '$lib/components/data';
	import EmployeeCard from './EmployeeCard.svelte';
	import MoreHorizontalIcon from '@lucide/svelte/icons/ellipsis';
	import UsersRoundIcon from '@lucide/svelte/icons/users-round';
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

	const filters = $derived([
		{
			key: 'search',
			placeholder: 'Поиск по ФИО или номеру...',
			type: 'string' as const,
			value: searchVal,
			onSearch: (v: string) => {
				searchVal = v;
				navigate({ search: v });
			}
		},
		{
			key: 'department',
			placeholder: 'Подразделение...',
			type: 'string' as const,
			value: deptVal,
			refs: data.departments,
			onSearch: (v: string) => {
				deptVal = v;
				navigate({ department: v });
			}
		},
		{
			key: 'position',
			placeholder: 'Должность...',
			type: 'string' as const,
			value: posVal,
			refs: data.positions,
			onSearch: (v: string) => {
				posVal = v;
				navigate({ position: v });
			}
		},
		{
			key: 'status',
			placeholder: 'Статус',
			type: 'select' as const,
			value: statusVal,
			options: [
				{ value: 'active', label: 'Активные' },
				{ value: 'dismissed', label: 'Уволенные' }
			],
			onSearch: (v: string) => {
				statusVal = v;
				navigate({ status: v });
			}
		}
	]);

	function sortIcon(field: string) {
		if (currentSort !== field) return '';
		return currentOrder === 'asc' ? ' ↑' : ' ↓';
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
			sort: currentSort || '',
			order: currentOrder ?? 'asc',
			...opts
		};

		for (const [k, v] of Object.entries(params)) {
			if (v && !(k === 'sort' && !v)) url.searchParams.set(k, v);
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
	</div>

	<DataToolbar
		{filters}
		actions={canEdit
			? [
					{
						label: 'Добавить сотрудника',
						onclick: () => goto('/apps/tabel/employees/create')
					}
				]
			: []}
	/>

	<DataPager
		page={pageNum}
		{totalPages}
		onPageChange={(p) => navigate({ page: String(p) })}
		class="sticky bottom-0 -mx-6 bg-background/95 px-6 pb-0 backdrop-blur-sm"
	/>

	<!-- Desktop: таблица -->
	<div class="hidden overflow-x-auto rounded-xl border bg-card md:block">
		<Table class="min-w-[760px]">
			<TableHeader>
				<TableRow class="bg-sidebar-accent/50">
					<TableHead
						class="cursor-pointer select-none"
						onclick={() => navigate({ sort: 'number', order: 'asc' })}
					>
						Таб. №{currentSort === 'number' ? sortIcon('number') : ''}
					</TableHead>
					<TableHead
						class="cursor-pointer select-none"
						onclick={() =>
							navigate({
								sort: 'lastName',
								order: currentSort === 'lastName' && currentOrder === 'asc' ? 'desc' : 'asc'
							})}
					>
						ФИО{currentSort === 'lastName' ? sortIcon('lastName') : ''}
					</TableHead>
					<TableHead>Подразделение</TableHead>
					<TableHead>Должность</TableHead>
					<TableHead class="text-center">Статус</TableHead>
					<TableHead class="w-10"></TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each employees as emp (emp.id)}
					<TableRow
						class="cursor-pointer hover:bg-muted"
						onclick={() => goto(`/apps/tabel/employees/${emp.id}`)}
					>
						<TableCell class="font-mono tabular-nums">{emp.number}</TableCell>
						<TableCell class="max-w-56 truncate font-medium">
							{emp.lastName}
							{emp.firstName}
							{emp.middleName ?? ''}
						</TableCell>
						<TableCell class="max-w-40 truncate">{emp.departmentName || '—'}</TableCell>
						<TableCell class="max-w-48 truncate" title={emp.positionName ?? ''}>
							{emp.positionName || '—'}
						</TableCell>
						<TableCell class="text-center">
							{#if emp.status === 'active'}
								<Badge variant="default">Активен</Badge>
							{:else if emp.status === 'dismissed'}
								<Badge variant="destructive">Уволен</Badge>
							{:else}
								<Badge variant="outline">Ожидает</Badge>
							{/if}
						</TableCell>
						<TableCell class="w-10">
							<DropdownMenu>
								<DropdownMenuTrigger
									class="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
									onclick={(e) => e.stopPropagation()}
									aria-label="Действия"
								>
									<MoreHorizontalIcon class="size-4" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onclick={() => goto(`/apps/tabel/employees/${emp.id}`)}
										>Открыть</DropdownMenuItem
									>
									{#if isAdmin}
										<DropdownMenuItem
											variant="destructive"
											onclick={() => ((deleteTarget = emp), (deleteOpen = true))}
										>
											Удалить
										</DropdownMenuItem>
									{/if}
								</DropdownMenuContent>
							</DropdownMenu>
						</TableCell>
					</TableRow>
				{:else}
					<TableRow>
						<TableCell colspan={6}>
							<Empty
								icon={UsersRoundIcon}
								title="Сотрудники не найдены"
								description="Измените фильтры поиска"
								class="border-none"
							/>
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	</div>

	<!-- Mobile: карточки -->
	<div class="grid gap-2 md:hidden">
		{#each employees as emp (emp.id)}
			<EmployeeCard
				employee={emp}
				{isAdmin}
				onopen={(e) => goto(`/apps/tabel/employees/${e.id}`)}
				ondelete={(e) => ((deleteTarget = e), (deleteOpen = true))}
			/>
		{:else}
			<Empty
				icon={UsersRoundIcon}
				title="Сотрудники не найдены"
				description="Измените фильтры поиска"
			/>
		{/each}
	</div>

	<DataPager
		page={pageNum}
		{totalPages}
		onPageChange={(p) => navigate({ page: String(p) })}
		class="sticky bottom-0 -mx-6 bg-background/95 px-6 pt-0 backdrop-blur-sm"
	/>

	{#if deleteTarget}
		<Dialog bind:open={deleteOpen}>
			<DialogContent class="max-w-md">
				<DialogHeader>
					<DialogTitle class="text-destructive">Удалить сотрудника?</DialogTitle>
				</DialogHeader>
				<div class={cn('space-y-3', 'text-sm')}>
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
