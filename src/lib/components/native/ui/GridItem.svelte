<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		class: className = '',
		children
	}: {
		class?: string;
		children: Snippet;
	} = $props();
</script>

<td class="n-grid-item {className}" style="width: calc(100% / var(--n-grid-cols, 2))">
	{@render children()}
</td>

<style>
	.n-grid-item {
		vertical-align: top;
		padding: 0 calc(var(--n-grid-gap, 12px) / 2);
		box-sizing: border-box;
	}
</style>
