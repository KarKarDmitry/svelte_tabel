<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		name,
		label = '',
		checked = false,
		value = '1',
		class: className,
		...restProps
	}: HTMLAttributes<HTMLInputElement> & {
		name: string;
		label?: string;
		checked?: boolean;
		value?: string | number;
		class?: string;
	} = $props();

	const cls = $derived(`n-check${className ? ' ' + className : ''}`);
</script>

<!-- hidden 0 + checkbox 1: неотмеченный чекбокс уходит в query как 0 -->
<label class={cls}>
	<input type="hidden" {name} value="0" />
	<input type="checkbox" {name} {value} {checked} class="n-check-input" {...restProps} />
	{#if label}<span class="n-check-label">{label}</span>{/if}
</label>

<style>
	.n-check {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		cursor: pointer;
		font-size: 13px;
	}
	.n-check-input {
		margin: 0;
		cursor: pointer;
	}
	.n-check-label {
		color: #232323;
	}
</style>
