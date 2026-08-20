<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		id,
		title,
		width = 860,
		class: className = '',
		children,
		footer,
		...rest
	}: {
		/** Уникальный id — на него завязаны xpDialogOpen/xpDialogClose */
		id: string;
		title: string;
		/** Ширина панели, px */
		width?: number;
		class?: string;
		children: Snippet;
		/** Кнопки в нижней части диалога */
		footer: Snippet;
		/** Произвольные атрибуты (data-*) на корневом div */
		[key: string]: any;
	} = $props();

	function esc(s: string): string {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// Вся интерактивная разметка через {@html}: Svelte запрещает строковые onclick.
	// Разметка всегда в DOM (SSR) — показ/скрытие только через инлайн style.display.
	const overlayHtml = $derived(
		`<div class="xp-dialog-overlay" onclick="xpDialogClose('${esc(id)}')"></div>`
	);
	const headHtml = $derived(
		`<div class="xp-dialog-head"><span class="xp-dialog-title">${esc(title)}</span>` +
			`<span class="xp-dialog-close" title="Закрыть" onclick="xpDialogClose('${esc(id)}')">[x]</span></div>`
	);
</script>

<div {id} class="xp-dialog {className}" style="display: none" {...rest}>
	{@html overlayHtml}
	<div class="xp-dialog-panel" style="max-width:{width}px">
		{@html headHtml}
		<div class="xp-dialog-body">
			{@render children()}
		</div>
		{#if footer}
			<div class="xp-dialog-foot">
				{@render footer()}
			</div>
		{/if}
	</div>
</div>
