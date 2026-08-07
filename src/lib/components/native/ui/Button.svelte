<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		href,
		variant = 'default',
		size = 'md',
		type = 'button',
		disabled = false,
		class: className = '',
		children
	}: {
		href?: string;
		variant?: 'default' | 'outline' | 'danger' | 'ghost';
		size?: 'md' | 'sm';
		type?: 'button' | 'submit';
		disabled?: boolean;
		class?: string;
		children: Snippet;
	} = $props();

	const cls = $derived(`n-btn n-btn-${variant} n-btn-${size}${className ? ' ' + className : ''}`);
</script>

{#if href}
	<a {href} class={cls}>{@render children()}</a>
{:else}
	<button {type} {disabled} class={cls}>{@render children()}</button>
{/if}

<style>
	.n-btn {
		display: inline-block;
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 14px;
		line-height: 1.2;
		padding: 8px 18px;
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		text-decoration: none;
		box-sizing: border-box;
		transition: background-color 0.15s ease;
	}
	.n-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.n-btn-default {
		background: #232323;
		color: #fafafa;
		border-color: #232323;
	}
	.n-btn-default:hover:not(:disabled) {
		background: #3f3f3f;
	}
	.n-btn-outline {
		background: #ffffff;
		color: #232323;
		border-color: #c3c3c3;
	}
	.n-btn-outline:hover:not(:disabled) {
		background: #f5f5f5;
	}
	.n-btn-danger {
		background: #b91c1c;
		color: #ffffff;
		border-color: #b91c1c;
	}
	.n-btn-danger:hover:not(:disabled) {
		background: #dc2626;
	}
	.n-btn-ghost {
		background: transparent;
		color: #4b5563;
		border-color: transparent;
	}
	.n-btn-ghost:hover:not(:disabled) {
		background: #f5f5f5;
	}
	.n-btn-sm {
		padding: 4px 12px;
		font-size: 13px;
		border-radius: 4px;
	}
</style>
