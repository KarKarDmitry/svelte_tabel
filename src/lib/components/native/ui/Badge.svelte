<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'default',
		class: className = '',
		children
	}: {
		variant?: 'default' | 'danger' | 'success' | 'muted' | 'accent';
		class?: string;
		children: Snippet;
	} = $props();

	const cls = `n-badge n-badge-${variant}${className ? ' ' + className : ''}`;
</script>

<span class={cls}>{@render children()}</span>

<style>
	.n-badge {
		display: inline-block;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600;
		font-family: 'Tahoma', 'Arial', sans-serif;
	}
	.n-badge-default {
		background: #eef2ff;
		color: #3730a3;
	}
	.n-badge-danger {
		background: #fef2f2;
		color: #b91c1c;
	}
	.n-badge-success {
		background: #f0fdf4;
		color: #166534;
	}
	.n-badge-muted {
		background: #f3f4f6;
		color: #6b7280;
	}
	.n-badge-accent {
		background: #151619;
		color: #f3f4f6;
	}
</style>
