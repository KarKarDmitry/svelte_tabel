<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		cols = 2,
		gap = 12,
		class: className = '',
		children
	}: {
		cols?: number;
		gap?: number;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<!-- Таблица, эмулирующая grid: дети — компоненты GridItem (ячейки <td>) -->
<table class="n-grid" style="--n-grid-gap:{gap}px; --n-grid-cols:{cols}">
	<tbody>
		<tr>{@render children()}</tr>
	</tbody>
</table>

<style>
	.n-grid {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		margin-bottom: 4px;
	}
</style>
