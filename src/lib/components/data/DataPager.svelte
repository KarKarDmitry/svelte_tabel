<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';

	let {
		page = 1,
		totalPages = 1,
		onPageChange = (_page: number) => {},
		class: className = ''
	}: {
		page?: number;
		totalPages?: number;
		onPageChange?: (page: number) => void;
		class?: string;
	} = $props();
</script>

{#if totalPages > 1}
	<div class={cn('flex items-center justify-between gap-2 py-2 text-sm', className)}>
		<span class="text-muted-foreground">Страница {page} из {totalPages}</span>
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={page <= 1}
				onclick={() => onPageChange(page - 1)}>Назад</Button
			>
			<Button
				variant="outline"
				size="sm"
				disabled={page >= totalPages}
				onclick={() => onPageChange(page + 1)}>Вперед</Button
			>
		</div>
	</div>
{/if}
