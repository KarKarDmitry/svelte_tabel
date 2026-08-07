<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		title,
		children
	}: {
		id: string;
		title: string;
		children: Snippet;
	} = $props();

	function esc(s: string): string {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	// По умолчанию подразделение развёрнуто (xp-sub-content: display:block, индикатор [-])
	const headerHtml = $derived(
		`<div class="xp-sub-header" onclick="xpToggle('${id}')">${esc(title)} <span id="${id}_ind" class="xp-indicator">[-]</span></div>`
	);
</script>

<div class="xp-collapsible">
	{@html headerHtml}
	<!-- Инлайн display обязателен: xpToggle читает только style.display, а не CSS-класс -->
	<div {id} class="xp-sub-content" style="display: block">
		{@render children()}
	</div>
</div>
