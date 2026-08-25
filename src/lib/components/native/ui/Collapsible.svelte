<script lang="ts">
	import type { Snippet } from 'svelte';
	import { esc } from '$lib/apps/tabel/utils';

	let {
		id,
		title,
		children
	}: {
		id: string;
		title: string;
		children: Snippet;
	} = $props();

	// Заголовок через {@html}: Svelte запрещает строковые onclick на элементах.
	// По умолчанию группа свёрнута (xp-content: display:none, индикатор [+])
	const headerHtml = $derived(
		`<div class="xp-header" onclick="xpToggle('${esc(id)}')">${esc(title)} <span id="${esc(id)}_ind" class="xp-indicator">[+]</span></div>`
	);
</script>

<div class="xp-collapsible">
	{@html headerHtml}
	<!-- Инлайн display обязателен: xpToggle читает только style.display, а не CSS-класс -->
	<div {id} class="xp-content" style="display: none">
		{@render children()}
	</div>
</div>
