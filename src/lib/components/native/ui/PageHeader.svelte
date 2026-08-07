<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	let {
		title,
		note = '',
		backHref,
		backLabel = 'Назад'
	}: {
		title: string;
		note?: string;
		backHref?: string;
		backLabel?: string;
	} = $props();
</script>

<div class="n-header">
	{#if backHref}
		<a class="n-back" href={backHref}>
			<ArrowLeft size={14} style="vertical-align:middle;margin-right:4px" />
			{backLabel}
		</a>
	{/if}
	<h1 class="n-title">{title}</h1>
	{#if note}<p class="n-note">{note}</p>{/if}
</div>

<style>
	.n-header {
		margin-bottom: 14px;
	}
	.n-back {
		display: block;
		color: #6b7280;
		font-size: 13px;
		text-decoration: none;
		margin-bottom: 6px;
	}
	.n-back:hover {
		text-decoration: underline;
	}
	.n-title {
		font-family: 'Tahoma', 'Arial', sans-serif;
		font-size: 22px;
		font-weight: 700;
		color: #111827;
		margin: 0 0 4px;
	}
	.n-note {
		font-size: 14px;
		color: #6b7280;
		margin: 0;
	}
</style>
