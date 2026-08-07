<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		class: className = '',
		children
	}: {
		title?: string;
		class?: string;
		children: Snippet;
	} = $props();

	const cls = $derived(`n-card${className ? ' ' + className : ''}`);
</script>

<div class={cls}>
	{#if title}<div class="n-card-title">{title}</div>{/if}
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
		border-bottom: 2px solid #afafaf;
		padding-bottom: 10px;
		margin-bottom: 10px;
	}
</style>
