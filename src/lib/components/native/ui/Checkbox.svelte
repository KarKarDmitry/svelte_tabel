<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';

	let {
		name,
		label = '',
		checked = false,
		value = '1',
		class: className,
		children,
		...restProps
	}: HTMLAttributes<HTMLInputElement> & {
		name: string;
		label?: string;
		checked?: boolean;
		value?: string | number;
		class?: string;
		children?: Snippet;
	} = $props();

	const cls = $derived(`n-check${className ? ' ' + className : ''}`);

	// Press-состояние строки: label не получает :active при клике по input
	let pressed = $state(false);
</script>

<!-- hidden 0 + checkbox 1: неотмеченный чекбокс уходит в query как 0 -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<label
	class={cls}
	class:pressed
	onmousedown={() => (pressed = true)}
	onmouseup={() => (pressed = false)}
	onmouseleave={() => (pressed = false)}
>
	<input type="hidden" {name} value="0" />
	<input type="checkbox" {name} {value} {checked} class="n-check-input" {...restProps} />
	{#if children}
		{@render children()}
	{:else if label}
		<span class="n-check-label">{label}</span>
	{/if}
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
	.pressed {
		background: #e2e2e2;
	}
</style>
