<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Dialog, DialogContent } from '$lib/components/ui/dialog';
	import { filterRenders, type FilterType } from './filter-renders/index.ts';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';

	export interface Column {
		key: string | string[];
		label: string;
		sortable?: boolean;
		mono?: boolean;
		sticky?: boolean;
		format?: (value: any, row: any) => string;
	}

	export interface Action {
		label: string | ((row: any) => string);
		onclick: (row: any) => void;
		variant?: 'default' | 'destructive';
	}

	export interface Filter {
		key: string;
		placeholder: string;
		type: FilterType;
		refs?: { name: string }[];
		options?: { value: string; label: string }[];
		value: string;
		onSearch: (value: string) => void;
	}

	let {
		data = [],
		columns = [] as Column[],
		filters = [] as Filter[],
		rowActions = [] as Action[],
		actions = [] as Action[],
		variant = 'default' as 'default' | 'ghost',
		class: className = '',
		page = 1,
		totalPages = 1,
		onPageChange = (_page: number) => {},
		sort = '',
		order = 'asc' as 'asc' | 'desc',
		onSort = (_key: string) => {},
		onRowClick,
		cell
	}: {
		data?: any[];
		columns?: Column[];
		filters?: Filter[];
		rowActions?: Action[];
		actions?: Action[];
		variant?: 'default' | 'ghost';
		class?: string;
		page?: number;
		totalPages?: number;
		onPageChange?: (page: number) => void;
		sort?: string;
		order?: 'asc' | 'desc';
		onSort?: (key: string) => void;
		onRowClick?: (row: any) => void;
		cell?: Snippet<[value: any, row: any, col: Column]>;
	} = $props();

	let filterOpen = $state(false);

	function getValue(row: any, key: string | string[]): any {
		if (Array.isArray(key)) {
			let val = row;
			for (const k of key) {
				if (val == null) return null;
				val = val[k];
			}
			return val;
		}
		return row[key];
	}

	function sortIcon(field: string) {
		if (sort !== field) return '↕';
		return order === 'asc' ? '↑' : '↓';
	}
</script>

<div class="flex flex-col {className}">
	<!-- Фильтры -->
	<div class={variant === 'default' ? `sticky top-0 z-10 bg-background/10 backdrop-blur-xs` : ''}>
		<div class="flex items-start justify-between gap-4">
			<!-- Фильтры: десктоп -->
			{#if filters.length > 0}
				<div class="hidden flex-1 flex-row flex-wrap gap-2 md:flex">
					{#each filters as f}
						{@const Cmp = filterRenders[f.type]}
						<Cmp
							value={f.value}
							onSearch={f.onSearch}
							placeholder={f.placeholder}
							options={f.options ?? []}
							refs={f.refs ?? []}
							listId={f.key + '-list'}
						/>
					{/each}
				</div>
				{#if filters.length > 0}
					<Button variant="outline" size="sm" onclick={() => (filterOpen = true)} class="md:hidden"
					    >Фильтры</Button
					>
				{/if}
			{/if}

			<!-- Actions -->
			<div class="flex gap-2">
				{#each actions as act}
					<Button
						variant={act.variant ?? 'default'}
						onclick={() => act.onclick(null)}
						class="hidden sm:inline-flex">{act.label}</Button
					>
				{/each}
				{#if actions.length > 1}
					<DropdownMenu>
						<DropdownMenuTrigger>
							<Button size="sm" class="sm:hidden">Действия</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{#each actions as act}
								<DropdownMenuItem
									variant={act.variant ?? 'default'}
									onclick={() => act.onclick(null)}>{act.label}</DropdownMenuItem
								>
							{/each}
						</DropdownMenuContent>
					</DropdownMenu>
				{/if}
			</div>
		</div>
	</div>

	<!-- Мобильный Dialog с фильтрами -->
	<Dialog bind:open={filterOpen}>
		<DialogContent>
			{#each filters as f}
				{@const Cmp = filterRenders[f.type]}
				<Cmp
					value={f.value}
					onSearch={f.onSearch}
					placeholder={f.placeholder}
					options={f.options ?? []}
					refs={f.refs ?? []}
					listId={f.key + '-list-mob'}
				/>
			{/each}
		</DialogContent>
	</Dialog>

	<!-- Таблица -->
	<div class="flex-1 overflow-auto pt-2">
		<div class={variant === 'default' ? 'rounded-3xl border-2 bg-card' : ''}>
			<Table>
				<TableHeader>
					<TableRow class="rounded-3xl border-b-2 bg-sidebar-accent">
						{#each columns as col}
							<TableHead
								class="border-r font-bold {col.sortable
									? 'cursor-pointer select-none'
									: ''} {col.sticky ? 'sticky left-0 z-20' : ''}"
								onclick={col.sortable ? () => onSort(col.key as string) : undefined}
							>
								{col.label}
								{col.sortable ? sortIcon(col.key as string) : ''}
							</TableHead>
						{/each}
						{#if rowActions.length > 0}
							<TableHead class="w-10"></TableHead>
						{/if}
					</TableRow>
				</TableHeader>
				<TableBody>
					{#each data as row}
						<TableRow
							class={onRowClick ? 'cursor-pointer hover:bg-muted' : ''}
							onclick={onRowClick ? () => onRowClick(row) : undefined}
						>
							{#each columns as col}
								<TableCell
									class="border-r font-medium {col.mono ? 'font-mono' : ''} {col.sticky
										? 'sticky left-0 z-10 bg-card'
										: ''}"
								>
									{#if cell}
										{@render cell(getValue(row, col.key), row, col)}
									{:else}
										{col.format
											? col.format(getValue(row, col.key), row)
											: (getValue(row, col.key) ?? '—')}
									{/if}
								</TableCell>
							{/each}
							{#if rowActions.length > 0}
								<TableCell onclick={(e) => e.stopPropagation()}>
									<DropdownMenu>
										<DropdownMenuTrigger>
											<div
												class="flex h-4 w-4 cursor-pointer items-center justify-center rounded-md text-sm hover:bg-muted"
											>
												...
											</div>
										</DropdownMenuTrigger>
										<DropdownMenuContent>
											{#each rowActions as act}
												<DropdownMenuItem
													variant={act.variant ?? 'default'}
													onclick={() => act.onclick(row)}
												>
													{typeof act.label === 'function' ? act.label(row) : act.label}
												</DropdownMenuItem>
											{/each}
										</DropdownMenuContent>
									</DropdownMenu>
								</TableCell>
							{/if}
						</TableRow>
					{:else}
						<TableRow>
							<TableCell
								colspan={columns.length + (rowActions.length ? 1 : 0)}
								class="text-center text-muted-foreground"
							>
								Нет данных
							</TableCell>
						</TableRow>
					{/each}
				</TableBody>
			</Table>
		</div>
	</div>

	<!-- Пагинация -->
	{#if totalPages > 1}
		<div
			class="sticky bottom-0 z-10 -mx-6 flex justify-between bg-background/10 px-6 py-2 text-sm backdrop-blur-sm"
		>
			<span>Страница {page} из {totalPages}</span>
			<div class="flex gap-2">
				<Button size="sm" disabled={page <= 1} onclick={() => onPageChange(page - 1)}>Назад</Button>
				<Button size="sm" disabled={page >= totalPages} onclick={() => onPageChange(page + 1)}
					>Вперед</Button
				>
			</div>
		</div>
	{/if}
</div>
