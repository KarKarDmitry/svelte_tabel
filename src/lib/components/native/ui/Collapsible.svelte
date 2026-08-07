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

	// Заголовок через {@html}: Svelte запрещает строковые onclick на элементах.
	// По умолчанию группа свёрнута (xp-content: display:none, индикатор [+])
	const headerHtml = $derived(
		`<div class="xp-header" onclick="xpToggle('${id}')">${esc(title)} <span id="${id}_ind" class="xp-indicator">[+]</span></div>`
	);
</script>

<div class="xp-collapsible">
	{@html headerHtml}
	<!-- Инлайн display обязателен: xpToggle читает только style.display, а не CSS-класс -->
	<div {id} class="xp-content" style="display: none">
		{@render children()}
	</div>
</div>
