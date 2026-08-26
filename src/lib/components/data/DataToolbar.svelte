<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Sheet from '$lib/components/ui/sheet';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';
	import { filterRenders, type FilterType } from '$lib/components/DTable/filter-renders/index.ts';

	/**
	 * Тулбар списка: фильтры + действия.
	 * Desktop — строка фильтров и кнопки; mobile — кнопка «Фильтры» с бейджем
	 * активных (Sheet со стеком) и выпадающее меню действий.
	 */

	export interface ToolbarFilter {
		key: string;
		placeholder: string;
		type: FilterType;
		refs?: { name: string }[];
		options?: { value: string; label: string }[];
		value: string;
		onSearch: (value: string) => void;
	}

	export interface ToolbarAction {
		label: string;
		onclick: () => void;
		variant?: 'default' | 'destructive' | 'outline';
	}

	let {
		filters = [] as ToolbarFilter[],
		actions = [] as ToolbarAction[],
		class: className = ''
	}: {
		filters?: ToolbarFilter[];
		actions?: ToolbarAction[];
		class?: string;
	} = $props();

	let sheetOpen = $state(false);

	const activeFilters = $derived(filters.filter((f) => f.value !== '' && f.value != null).length);
</script>

<div class={cn('flex items-end justify-between gap-4', className)}>
	<!-- Фильтры: desktop -->
	{#if filters.length > 0}
		<div class="hidden min-w-0 flex-1 flex-row flex-wrap gap-2 md:flex">
			{#each filters as f (f.key)}
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
	{/if}

	<!-- Фильтры: mobile -->
	{#if filters.length > 0}
		<Button variant="outline" size="sm" class="md:hidden" onclick={() => (sheetOpen = true)}>
			<SlidersHorizontalIcon data-icon="inline-start" />
			Фильтры
			{#if activeFilters > 0}
				<Badge class="size-5 justify-center p-0 tabular-nums">{activeFilters}</Badge>
			{/if}
		</Button>

		<Sheet.Root bind:open={sheetOpen}>
			<Sheet.Content side="left" class="flex w-80 flex-col gap-4 overflow-y-auto">
				<Sheet.Header>
					<Sheet.Title>Фильтры</Sheet.Title>
					<Sheet.Description>Фильтрация списка</Sheet.Description>
				</Sheet.Header>
				<div class="flex flex-col gap-3">
					{#each filters as f (f.key)}
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
				</div>
				{#if activeFilters > 0}
					<Button variant="ghost" size="sm" onclick={() => filters.forEach((f) => f.onSearch(''))}>
						Сбросить всё
					</Button>
				{/if}
			</Sheet.Content>
		</Sheet.Root>
	{/if}

	<!-- Действия -->
	<div class="flex shrink-0 gap-2">
		{#if actions.length === 1}
			<Button
				variant={actions[0].variant ?? 'default'}
				size="sm"
				onclick={() => actions[0].onclick()}>{actions[0].label}</Button
			>
		{:else if actions.length > 1}
			<div class="hidden gap-2 sm:flex">
				{#each actions as act (act.label)}
					<Button variant={act.variant ?? 'default'} size="sm" onclick={() => act.onclick()}
						>{act.label}</Button
					>
				{/each}
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger>
					<Button size="sm" class="sm:hidden">Действия</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{#each actions as act (act.label)}
						<DropdownMenuItem variant={act.variant ?? 'default'} onclick={() => act.onclick()}>
							{act.label}
						</DropdownMenuItem>
					{/each}
				</DropdownMenuContent>
			</DropdownMenu>
		{/if}
	</div>
</div>
