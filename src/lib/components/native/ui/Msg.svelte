<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'info',
		class: className = '',
		children
	}: {
		variant?: 'info' | 'ok' | 'err';
		class?: string;
		children: Snippet;
	} = $props();

	const cls = $derived(`n-msg n-msg-${variant}${className ? ' ' + className : ''}`);
</script>

<div class={cls}>{@render children()}</div>

<style>
	.n-msg {
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 8px 12px;
		margin-bottom: 12px;
		font-size: 14px;
		font-family: 'Tahoma', 'Arial', sans-serif;
	}
	.n-msg-info {
		background: #f9fafb;
		color: #374151;
	}
	.n-msg-ok {
		background: #f0fdf4;
		border-color: #86efac;
		color: #166534;
	}
	.n-msg-err {
		background: #fef2f2;
		border-color: #fca5a5;
		color: #b91c1c;
	}
</style>
