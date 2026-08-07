<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Сводка, видимая только пока родительский Collapsible/SubCollapsible свёрнут.
	 * Размещается СРАЗУ ПОСЛЕ коллапсибла как соседний элемент и связывается
	 * с ним по id (должен совпадать с id родителя).
	 *
	 * Использование:
	 *   <Collapsible id="grp_1" title="...">…детали…</Collapsible>
	 *   <CollapsibleSubheader id="grp_1">…краткая сводка…</CollapsibleSubheader>
	 */
	let {
		id,
		open = false,
		class: className = '',
		children
	}: {
		/** id родительского Collapsible/SubCollapsible */
		id: string;
		/** раскрыт ли родитель по умолчанию (влияет на начальное состояние) */
		open?: boolean;
		class?: string;
		children: Snippet;
	} = $props();

	const cls = $derived(`xp-subheader${className ? ' ' + className : ''}`);
</script>

<div id={id + '_sub'} class={cls} style="display: {open ? 'none' : 'block'}">
	{@render children()}
</div>
