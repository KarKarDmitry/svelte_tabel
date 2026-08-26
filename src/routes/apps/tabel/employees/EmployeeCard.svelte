<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import {
		DropdownMenu,
		DropdownMenuTrigger,
		DropdownMenuContent,
		DropdownMenuItem
	} from '$lib/components/ui/dropdown-menu';
	import MoreHorizontalIcon from '@lucide/svelte/icons/ellipsis';

	let {
		employee,
		isAdmin = false,
		onopen,
		ondelete
	}: {
		employee: any;
		isAdmin?: boolean;
		onopen: (emp: any) => void;
		ondelete?: (emp: any) => void;
	} = $props();

	const status = $derived.by(() => {
		if (employee.status === 'active') return { label: 'Активен', variant: 'default' as const };
		if (employee.status === 'dismissed')
			return { label: 'Уволен', variant: 'destructive' as const };
		return { label: 'Ожидает', variant: 'outline' as const };
	});
</script>

<!-- Мобильная карточка сотрудника (паттерн «два представления», <md) -->
<Card
	role="button"
	tabindex="0"
	class="cursor-pointer gap-2 p-3 transition-colors hover:bg-muted/40"
	onclick={() => onopen(employee)}
	onkeydown={(e) => {
		if (e.key === 'Enter') onopen(employee);
	}}
>
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<div class="truncate leading-tight font-medium">
				{employee.lastName}
				{employee.firstName}
				{employee.middleName ?? ''}
			</div>
			<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
				<span class="font-mono tabular-nums">№ {employee.number}</span>
				<span class="truncate">{employee.departmentName || '—'}</span>
			</div>
			<div class="mt-0.5 truncate text-xs text-muted-foreground">
				{employee.positionName || ''}
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-1">
			<Badge variant={status.variant}>{status.label}</Badge>
			<DropdownMenu>
				<DropdownMenuTrigger
					class="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
					onclick={(e) => e.stopPropagation()}
					aria-label="Действия"
				>
					<MoreHorizontalIcon class="size-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onclick={() => onopen(employee)}>Открыть</DropdownMenuItem>
					{#if isAdmin && ondelete}
						<DropdownMenuItem variant="destructive" onclick={() => ondelete(employee)}>
							Удалить
						</DropdownMenuItem>
					{/if}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	</div>
</Card>
