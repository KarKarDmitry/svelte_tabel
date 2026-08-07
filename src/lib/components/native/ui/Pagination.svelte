<script lang="ts">
	import Button from './Button.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	let {
		page,
		totalPages,
		makeHref
	}: {
		page: number;
		totalPages: number;
		makeHref: (p: number) => string;
	} = $props();

	const icoStyle = 'vertical-align:middle';
</script>

<div class="n-pager">
	{#if page > 1}
		<span class="n-pager-btn"
			><Button href={makeHref(page - 1)} variant="outline" size="sm"
				><ArrowLeft size={14} style={icoStyle} />&nbsp;Пред.</Button
			></span
		>
	{:else}
		<span class="n-pager-disabled"><ArrowLeft size={14} style={icoStyle} />&nbsp;Пред.</span>
	{/if}
	<span class="n-pager-info">Страница {page} из {totalPages}</span>
	{#if page < totalPages}
		<span class="n-pager-btn"
			><Button href={makeHref(page + 1)} variant="outline" size="sm"
				>След.&nbsp;<ArrowRight size={14} style={icoStyle} /></Button
			></span
		>
	{:else}
		<span class="n-pager-disabled">След.&nbsp;<ArrowRight size={14} style={icoStyle} /></span>
	{/if}
</div>

<style>
	.n-pager {
		margin-top: 12px;
	}
	.n-pager-btn {
		margin-right: 4px;
	}
	.n-pager-info {
		margin: 0 10px;
		font-size: 13px;
		color: #6b7280;
	}
	.n-pager-disabled {
		color: #c0c0c0;
		font-size: 13px;
	}
</style>
