<script lang="ts">
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import type { Component } from 'svelte';

	/**
	 * Состояние пустого списка: иконка, заголовок, описание, опциональное действие.
	 * Замена ad-hoc `border-dashed text-center` заглушкам.
	 */
	let {
		icon: Icon = undefined,
		title = 'Нет данных',
		description = '',
		actionLabel,
		onAction,
		class: className = ''
	}: {
		icon?: Component<Record<string, unknown>> | undefined;
		title?: string;
		description?: string;
		actionLabel?: string;
		onAction?: () => void;
		class?: string;
	} = $props();
</script>

<div
	class={cn(
		'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center',
		className
	)}
>
	{#if Icon}
		<div class="text-muted-foreground [&_svg]:size-8"><Icon /></div>
	{/if}
	<h3 class="text-sm font-medium">{title}</h3>
	{#if description}
		<p class="max-w-sm text-sm text-muted-foreground">{description}</p>
	{/if}
	{#if actionLabel && onAction}
		<Button size="sm" class="mt-2" onclick={onAction}>{actionLabel}</Button>
	{/if}
</div>
