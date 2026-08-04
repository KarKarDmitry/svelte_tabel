<script lang="ts">
	let {
		progress = '',
		division = '',
		employee = '',
		current = 0,
		total = 0,
		onCancel
	}: {
		progress: string;
		division?: string;
		employee?: string;
		current?: number;
		total?: number;
		onCancel?: () => void;
	} = $props();
</script>

<div
	class="flex w-72 flex-col gap-2 rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl"
>
	<div class="flex items-center justify-between gap-2">
		<span class="truncate text-sm font-medium">{progress}</span>
		{#if onCancel}
			<button
				type="button"
				class="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				onclick={onCancel}
				aria-label="Отменить экспорт"
			>
				✕
			</button>
		{/if}
	</div>

	{#if division}<div class="truncate text-xs text-muted-foreground">{division}</div>{/if}
	{#if employee}<div class="truncate text-xs text-muted-foreground">{employee}</div>{/if}

	{#if total > 0}
		<div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div
				class="h-full rounded-full bg-primary transition-all duration-300"
				style="width: {(current / total) * 100}%"
			></div>
		</div>
		<div class="text-xs text-muted-foreground tabular-nums">
			{current} / {total}
		</div>
	{:else}
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<div
				class="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
			Загрузка данных…
		</div>
	{/if}
</div>
