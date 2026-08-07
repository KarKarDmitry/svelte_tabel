<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		gap = 12,
		class: className = '',
		maxWidth = '100%',
		children
	}: {
		/** Отступ между элементами, px */
		gap?: number;
		class?: string;
		maxWidth?: string;
		children: Snippet;
	} = $props();

	// Половинку отступа считаем в JS: Chrome 49 не понимает деление в calc()
	const gapHalf = $derived(`${gap / 2}px`);
</script>

<!-- Переносимая лента: дети встают по своей ширине, сколько влезает в строку -->
<div
	class="n-flex {className}"
	style:--n-flex-gap="{gap}px"
	style:--n-flex-gap-half={gapHalf}
	style:max-width={maxWidth}
>
	{@render children()}
</div>

<style>
	.n-flex {
		display: flex;
		flex-wrap: wrap;
	}
	/* Отступы через padding (flex-gap не работает на XP/Chrome 49); ширину задают сами дети */
	:global(.n-flex > *) {
		padding: 0 var(--n-flex-gap-half, 6px) var(--n-flex-gap, 12px);
		box-sizing: border-box;
	}
</style>
