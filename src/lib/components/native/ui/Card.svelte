<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		note,
		class: className = '',
		children
	}: {
		title?: string;
		note?: string;
		class?: string;
		children: Snippet;
	} = $props();

	const cls = $derived(`n-card${className ? ' ' + className : ''}`);
</script>

<div class={cls}>
	{#if title}<div class="n-card-title">{title}</div>{/if}
	{#if note}<div class="n-card-note">{note}</div>{/if}
	<div class="n-card-sep"></div>
	{@render children()}
</div>

<style>
	.n-card {
		background: #ffffff;
		border: 1px solid #afafaf;
		border-radius: 10px;
		padding: 14px 16px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
		margin-bottom: 14px;
	}
	.n-card-title {
		font-size: 15px;
		font-weight: 600;
		color: #111827;
	}
	.n-card-note {
		font-size: 14px;
		color: #6b7280;
		margin: 0;
	}
	.n-card-sep {
		border-bottom: 2px solid #afafaf;
		padding-bottom: 10px;
		margin-bottom: 10px;
	}
</style>
